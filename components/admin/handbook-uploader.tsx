"use client"

import { CircleCheck, FileUp, LoaderCircle } from "lucide-react"
import { useRef, useState } from "react"

import { registerHandbook } from "@/app/admin/documents/actions"
import { Field, selectClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const MAX_BYTES = 25 * 1024 * 1024

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string }

export function HandbookUploader() {
  const formRef = useRef<HTMLFormElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const busy = phase.kind === "uploading" || phase.kind === "processing"

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const file = form.get("file")
    const title = String(form.get("title") ?? "").trim()
    const visibility = form.get("visibility") === "authenticated" ? "authenticated" : "public"

    if (!(file instanceof File) || file.size === 0) return setPhase({ kind: "error", message: "Choose a PDF file." })
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return setPhase({ kind: "error", message: "Only PDF files are supported." })
    }
    if (file.size > MAX_BYTES) return setPhase({ kind: "error", message: "PDFs can be up to 25 MB." })

    // 1. Upload straight to the private documents bucket (admin-only by storage policy).
    setPhase({ kind: "uploading" })
    const filePath = `handbook/${crypto.randomUUID()}.pdf`
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { contentType: "application/pdf", upsert: false })
    if (uploadError) return setPhase({ kind: "error", message: "Upload failed. Please try again." })

    // 2. Register the document and extract + chunk its text on the server.
    setPhase({ kind: "processing" })
    const result = await registerHandbook({ title, visibility, filePath, fileName: file.name, fileSize: file.size })
    if (!result.ok) return setPhase({ kind: "error", message: result.error })

    formRef.current?.reset()
    setPhase({
      kind: "done",
      message: `Ready: text extracted from ${result.pages} pages into ${result.chunks} sections.`,
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Field id="title" label="Title" hint="Shown in citations, e.g. “Student Handbook — Page 42”.">
          <Input id="title" name="title" defaultValue="Student Handbook" required aria-describedby="title-hint" />
        </Field>
        <Field id="visibility" label="Who can it answer for?">
          <select id="visibility" name="visibility" defaultValue="public" className={selectClass}>
            <option value="public">Everyone (public assistant and students)</option>
            <option value="authenticated">Signed-in students only</option>
          </select>
        </Field>
      </div>

      <Field id="file" label="PDF file" hint="Selectable-text PDFs only (no scanned pages). Up to 25 MB.">
        <Input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          disabled={busy}
          aria-describedby="file-hint"
          className="h-auto py-1.5 file:mr-3 file:rounded-md file:bg-muted file:px-2.5 file:py-1"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
          {phase.kind === "uploading" ? "Uploading…" : phase.kind === "processing" ? "Extracting text…" : "Upload and process"}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {phase.kind === "done" && (
            <span className="inline-flex items-start gap-1.5 text-foreground">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {phase.message}
            </span>
          )}
          {phase.kind === "processing" && (
            <span className="text-muted-foreground">Reading pages and splitting them into sections. Large handbooks can take a minute.</span>
          )}
        </p>
      </div>
      {phase.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {phase.message}
        </p>
      )}
    </form>
  )
}
