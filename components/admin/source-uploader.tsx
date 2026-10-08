"use client"

import { CircleAlert, FileText, LoaderCircle, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { discardUnregisteredSource, registerSource } from "@/app/admin/documents/actions"
import { Field, selectClass, textareaClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  EXTENSIONS,
  IMAGE_TYPES,
  MAX_SOURCE_BYTES,
  PDF,
  SOURCE_TYPE_OPTIONS,
  type UploadSourceType,
  formatFileSize,
} from "@/lib/sources"
import { createClient } from "@/lib/supabase/client"
import { cn } from "cn"

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string }

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

/**
 * Client-side checks before upload; the server re-checks the real bytes. Knowledge Library
 * uploads are PDF only; "image" is for replacing the file of an older image source.
 */
export function checkSourceFile(file: File, allowed: "pdf" | "image" = "pdf"): string | null {
  const mime = mimeOf(file)
  if (allowed === "pdf" && mime !== PDF) return "Only PDF files are supported."
  if (allowed === "image" && !(IMAGE_TYPES as readonly string[]).includes(mime)) return "Choose a PNG, JPG/JPEG or WebP image."
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

/**
 * Upload PDF modal (opened from Add source): Title, Description, File (PDF only). The PDF
 * is analyzed later, on request. collectionType: the source type the collection implies
 * (set by the server); the Source type field only appears when the collection has none.
 */
export function SourceUploader({ collectionId, collectionType, open, onOpenChange }: {
  collectionId: string | null
  collectionType: UploadSourceType | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [sourceType, setSourceType] = useState<UploadSourceType>("handbook")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  const busy = phase.kind === "uploading"
  const typeHint = SOURCE_TYPE_OPTIONS.find((o) => o.value === sourceType)?.hint

  function reset() {
    setTitle("")
    setDescription("")
    setSourceType("handbook")
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

  /** Clears the selected file and returns to the empty dropzone; the modal stays open. */
  function removeFile() {
    // A title filled in from this file's name goes with it; a typed title stays.
    if (file && title === titleFromFileName(file.name)) setTitle("")
    setFile(null)
    setPhase({ kind: "idle" })
    if (inputRef.current) {
      inputRef.current.value = ""
      inputRef.current.focus()
    }
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
        description: description.trim(),
        sourceType: collectionType ?? sourceType,
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
          onOpenChange(next)
          if (!next) reset()
        }}
      >

        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader className="border-b px-6 pt-5 pb-4">
            <DialogTitle className="text-base font-semibold">Upload PDF</DialogTitle>
            <DialogDescription>Upload a text-selectable PDF up to 25 MB. After upload, you can analyze it with AI to create draft knowledge sections for review.</DialogDescription>
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

            <Field id="source-description" label="Description" optional hint="Admin note shown on the source card. Not used to answer students.">
              <textarea
                id="source-description"
                value={description}
                rows={3}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this source contains..."
                disabled={busy}
                className={cn(textareaClass, "min-h-0 resize-y")}
                aria-describedby="source-description-hint"
              />
            </Field>

            {!collectionType && (
              <Field id="source-type" label="Source type" hint={typeHint}>
                <select
                  id="source-type"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as UploadSourceType)}
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
            )}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" id="source-file-label">
                File
              </span>
              {/* Native file input: visually hidden but focusable; the label is the click/drop target. */}
              <input
                ref={inputRef}
                id="source-file"
                type="file"
                accept={`.pdf,${PDF}`}
                disabled={busy}
                onChange={(e) => pick(e.target.files?.[0])}
                aria-labelledby="source-file-label"
                className="peer sr-only"
              />
              <div className="relative">
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
                    dragging && "border-ring bg-accent",
                    file && "pr-14" // room for Remove file
  
                  )}
                >
                  {file ? (
                    <>
                      <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{file.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatFileSize(file.size)} · click or drop to replace
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
                          PDF only
                        </span>
                      </span>
                    </>
                  )}
                </label>
                {/* Outside the label, so removing never opens the file picker. */}
                {file && (
                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={busy}
                    aria-label="Remove file"
                    title="Remove file"
                    className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

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
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
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
