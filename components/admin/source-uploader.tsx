"use client"

import { CircleAlert, CircleCheck, FileText, ImageIcon, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { discardUnregisteredSource, registerSource } from "@/app/admin/documents/actions"
import { Field, selectClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  EXTENSIONS,
  IMAGE_TYPES,
  MAX_SOURCE_BYTES,
  PDF,
  SOURCE_TYPE_OPTIONS,
  formatFileSize,
  isReferenceOnly,
} from "@/lib/sources"
import { createClient } from "@/lib/supabase/client"
import { cn } from "cn"

type UploadType = "handbook" | "policy" | "announcement" | "calendar" | "campus_map" | "other"

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing" }
  | { kind: "error"; message: string }

const IMAGE_ACCEPT = [".png", ".jpg", ".jpeg", ".webp", ...IMAGE_TYPES]

/** The file's MIME type, falling back to its extension when the browser leaves it blank. */
function mimeOf(file: File) {
  if (file.type) return file.type === "image/jpg" ? "image/jpeg" : file.type
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) return PDF
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".webp")) return "image/webp"
  return ""
}

/** "student-handbook_2026.pdf" → "Student handbook 2026" */
function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ""
}

/** "Upload source" button + modal: Title, Source type, File. */
export function SourceUploader({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(defaultOpen)
  const [title, setTitle] = useState("")
  const [sourceType, setSourceType] = useState<UploadType>("handbook")
  const [visibility, setVisibility] = useState<"public" | "authenticated">("public")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<{ message: string; id: string } | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  const busy = phase.kind === "uploading" || phase.kind === "processing"
  const referenceOnly = isReferenceOnly(sourceType, file ? mimeOf(file) : undefined)
  const typeHint = file && mimeOf(file) !== PDF
    ? "Images are stored as reference files; text is not extracted."
    : SOURCE_TYPE_OPTIONS.find((o) => o.value === sourceType)?.hint

  function reset() {
    setTitle("")
    setSourceType("handbook")
    setVisibility("public")
    setFile(null)
    setDragging(false)
    setPhase({ kind: "idle" })
    if (inputRef.current) inputRef.current.value = ""
  }

  function pick(selected: File | undefined) {
    if (!selected) return
    setFile(null)
    if (inputRef.current) inputRef.current.value = ""
    const mime = mimeOf(selected)
    if (mime !== PDF && !(IMAGE_TYPES as readonly string[]).includes(mime)) {
      setPhase({ kind: "error", message: "Choose a PDF, PNG or JPG/JPEG image." })
      return
    }
    if (selected.size === 0) {
      setPhase({ kind: "error", message: "This file is empty. Choose a file with content." })
      return
    }
    if (selected.size > MAX_SOURCE_BYTES) {
      setPhase({ kind: "error", message: `This file is ${formatFileSize(selected.size)}. Files can be up to 25 MB.` })
      return
    }
    if (!title.trim()) setTitle(titleFromFileName(selected.name))
    setFile(selected)
    setPhase({ kind: "idle" })
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return setPhase({ kind: "error", message: "Choose a file to upload." })
    if (title.trim().length < 2) return setPhase({ kind: "error", message: "Enter a title (at least 2 characters)." })
    const mime = mimeOf(file)
    let uploadedPath: string | null = null

    try {
      setNotice(null)
      // 1. Upload straight to the private documents bucket (admin-only by storage policy).
      setPhase({ kind: "uploading" })
      const filePath = `sources/${crypto.randomUUID()}.${EXTENSIONS[mime]}`
      uploadedPath = filePath
      const { error: uploadError } = await createClient()
        .storage.from("documents")
        .upload(filePath, file, { contentType: mime, upsert: false })
      if (uploadError) {
        return setPhase({ kind: "error", message: `Upload failed: ${uploadError.message}` })
      }

      // 2. Save the source; text PDFs are extracted and chunked on the server.
      if (!referenceOnly) setPhase({ kind: "processing" })
      const result = await registerSource({
        title: title.trim(),
        sourceType,
        visibility,
        filePath,
        fileName: file.name,
        fileSize: file.size,
      })
      if (!result.ok) {
        router.refresh()
        return setPhase({ kind: "error", message: result.error })
      }

      setNotice({
        id: result.id,
        message: result.referenceOnly
          ? `“${title.trim()}” is stored as a reference file.`
          : `“${title.trim()}” is ready: ${result.pages} pages split into ${result.chunks} sections for the assistant.`,
      })
      setOpen(false)
      reset()
      router.refresh() // show the new source in the list
    } catch {
      if (uploadedPath) {
        try { await discardUnregisteredSource(uploadedPath) } catch { /* Keep referenced files safe if recovery fails. */ }
      }
      router.refresh()
      setPhase({ kind: "error", message: "The upload could not be completed. Check the Sources list before retrying; a saved PDF may need reprocessing." })
    }
  }

  return (
    <div className="mt-6">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return // don't close mid-upload
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogTrigger render={<Button size="lg" />}>
          <Upload aria-hidden="true" />
          Upload source
        </DialogTrigger>

        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader className="border-b px-6 pt-5 pb-4">
            <DialogTitle className="text-base font-semibold">Upload source</DialogTitle>
            <DialogDescription>PDF, PNG or JPG/JPEG. Up to 25 MB. Text-based PDFs are processed; images are stored as references.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-5" noValidate>
            <Field id="source-title" label="Title" hint="Shown in citations, e.g. “Student Handbook — Page 42”.">
              <Input
                id="source-title"
                value={title}
                maxLength={200}
                required
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Student Handbook"
                disabled={busy}
                aria-describedby="source-title-hint"
              />
            </Field>

            <Field id="source-type" label="Source type" hint={typeHint}>
              <select
                id="source-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as UploadType)}
                disabled={busy}
                className={selectClass}
                aria-describedby="source-type-hint"
              >
                {SOURCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" id="source-file-label">
                File
              </span>
              {/* Native file input: visually hidden but focusable; the label is the click/drop target. */}
              <input
                ref={inputRef}
                id="source-file"
                type="file"
                accept={[".pdf", PDF, ...IMAGE_ACCEPT].join(",")}
                disabled={busy}
                onChange={(e) => pick(e.target.files?.[0])}
                aria-labelledby="source-file-label"
                className="peer sr-only"
              />
              <label
                htmlFor="source-file"
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (!busy) pick(e.dataTransfer.files?.[0])
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-4 text-sm transition-colors hover:border-ring/50 hover:bg-muted/50 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                  dragging && "border-ring bg-accent"
                )}
              >
                {file ? (
                  <>
                    {mimeOf(file) === PDF ? (
                      <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{file.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatFileSize(file.size)} · click to choose a different file
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-primary">Choose a file</span>
                      <span className="text-muted-foreground"> or drag it here</span>
                      <span className="block text-xs text-muted-foreground">
                        PDF with selectable text, PNG or JPG/JPEG
                      </span>
                    </span>
                  </>
                )}
              </label>
            </div>

            <Field id="source-visibility" label="Who can see it?">
              <select
                id="source-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value === "authenticated" ? "authenticated" : "public")}
                disabled={busy}
                className={selectClass}
              >
                <option value="public">Everyone (public assistant and students)</option>
                <option value="authenticated">Signed-in students only</option>
              </select>
            </Field>

            {phase.kind === "error" && (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {phase.message}
              </p>
            )}
            {busy && (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {phase.kind === "uploading"
                  ? "Uploading the file…"
                  : "Reading pages and splitting them into sections. Large files can take a minute."}
              </p>
            )}

            <DialogFooter className="-mx-6 -mb-5 mt-1 border-t px-6 py-4">
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => { setOpen(false); reset() }}>Cancel</Button>
              <Button type="submit" size="lg" disabled={busy || !file}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {phase.kind === "uploading" ? "Uploading…" : phase.kind === "processing" ? "Processing…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {notice && (
        <p role="status" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {notice.message}
          <Link href={`/admin/documents/${notice.id}`} className="font-medium text-primary underline">View source</Link>
        </p>
      )}
    </div>
  )
}
