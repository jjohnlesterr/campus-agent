"use client"

import { CircleAlert, FileText, ImageIcon, LoaderCircle, Upload } from "lucide-react"
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
} from "@/lib/sources"
import { createClient } from "@/lib/supabase/client"
import { cn } from "cn"

// The campus map is uploaded from Admin › Campus Map, not as a Knowledge Library source.
type UploadType = "handbook" | "policy" | "announcement" | "calendar" | "other"

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string }

const IMAGE_ACCEPT = [".png", ".jpg", ".jpeg", ".webp", ...IMAGE_TYPES]

/** The file's MIME type, falling back to its extension when the browser leaves it blank. */
export function mimeOf(file: File) {
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

/** Client-side checks before upload; the server re-checks the real bytes. */
export function checkSourceFile(file: File, allowed: "any" | "pdf" | "image" = "any"): string | null {
  const mime = mimeOf(file)
  const isPdf = mime === PDF
  const isImage = (IMAGE_TYPES as readonly string[]).includes(mime)
  if (!isPdf && !isImage) return "Choose a PDF, PNG or JPG/JPEG image."
  if (allowed === "pdf" && !isPdf) return "Choose a PDF file."
  if (allowed === "image" && !isImage) return "Choose a PNG or JPG/JPEG image."
  if (file.size === 0) return "This file is empty. Choose a file with content."
  if (file.size > MAX_SOURCE_BYTES) return `This file is ${formatFileSize(file.size)}. Files can be up to 25 MB.`
  return null
}

/** Uploads straight to the private documents bucket (admin-only by storage policy). */
export async function uploadSourceFile(file: File): Promise<{ filePath: string } | { error: string }> {
  const mime = mimeOf(file)
  const filePath = `sources/${crypto.randomUUID()}.${EXTENSIONS[mime]}`
  const { error } = await createClient().storage.from("documents").upload(filePath, file, { contentType: mime, upsert: false })
  return error ? { error: `Upload failed: ${error.message}` } : { filePath }
}

/** "Upload PDF" button + modal: Title, Source type, File. PDFs are analyzed later, on request. */
export function SourceUploader({ collectionId }: { collectionId: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [sourceType, setSourceType] = useState<UploadType>("handbook")
  const [visibility, setVisibility] = useState<"public" | "authenticated">("public")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  const busy = phase.kind === "uploading"
  const typeHint = file && mimeOf(file) !== PDF
    ? "Images are stored as reference files to view; text is not extracted."
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
    const problem = checkSourceFile(selected)
    if (problem) {
      setPhase({ kind: "error", message: problem })
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
    let uploadedPath: string | null = null

    try {
      // 1. Upload the file; 2. verify it on the server and save the source (no processing yet).
      setPhase({ kind: "uploading" })
      const uploaded = await uploadSourceFile(file)
      if ("error" in uploaded) return setPhase({ kind: "error", message: uploaded.error })
      uploadedPath = uploaded.filePath
      const result = await registerSource({
        title: title.trim(),
        sourceType,
        visibility,
        collectionId,
        filePath: uploaded.filePath,
        fileName: file.name,
        fileSize: file.size,
      })
      if (!result.ok) {
        router.refresh()
        return setPhase({ kind: "error", message: result.error })
      }
      // Open the new source: PDFs show Analyze with AI there.
      router.push(`/admin/documents/${result.id}`)
    } catch {
      if (uploadedPath) {
        try { await discardUnregisteredSource(uploadedPath) } catch { /* Keep referenced files safe if recovery fails. */ }
      }
      router.refresh()
      setPhase({ kind: "error", message: "The upload could not be completed. Check the Knowledge Library before retrying." })
    }
  }

  return (
    <>
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
          Upload PDF
        </DialogTrigger>

        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader className="border-b px-6 pt-5 pb-4">
            <DialogTitle className="text-base font-semibold">Upload source</DialogTitle>
            <DialogDescription>PDF with selectable text, up to 25 MB. You can analyze it with AI after upload — nothing is published automatically. Campus maps can also be PNG or JPG images.</DialogDescription>
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
                Uploading the file…
              </p>
            )}

            <DialogFooter className="-mx-6 -mb-5 mt-1 border-t px-6 py-4">
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => { setOpen(false); reset() }}>Cancel</Button>
              <Button type="submit" size="lg" disabled={busy || !file}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {busy ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
