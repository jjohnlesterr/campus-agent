"use client"

import { Archive, ArchiveRestore, CircleAlert, ExternalLink, FileUp, LoaderCircle, MoreHorizontal, Sparkles, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { analyzeDocument, archiveDocument, deleteDocument, discardUnregisteredSource, replaceSourceFile, restoreDocument } from "@/app/admin/documents/actions"
import { checkSourceFile, uploadSourceFile } from "@/components/admin/source-uploader"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Props = {
  id: string
  title: string
  status: string
  isPdf: boolean
  fileUrl: string | null
  analyzed: boolean
  publishedCount: number
  otherSectionCount: number
}

type Open = "analyze" | "replace" | "archive" | "delete" | null

export function SourceActions({ id, title, status, isPdf, fileUrl, analyzed, publishedCount, otherSectionCount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState<Open>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const archived = status === "archived"
  const processing = status === "processing"

  function close(next: boolean) {
    if (pending) return
    if (!next) { setOpen(null); setError(null) }
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setError(result.error)
        setOpen(null)
        setNotice(done ?? null)
        router.refresh()
      } catch {
        setError("The request could not be completed. Refresh the page to check the current state.")
      }
    })
  }

  function analyze() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await analyzeDocument(id)
        if (!result.ok) return setError(result.error)
        setOpen(null)
        const sections = result.created === 1 ? "1 new Draft section" : `${result.created} new Draft sections`
        const existing = result.skipped ? ` ${result.skipped} existing ${result.skipped === 1 ? "section was" : "sections were"} left unchanged.` : ""
        const overview = result.overview ? "" : " The AI overview is unavailable right now; sections were created from the document's headings."
        setNotice(`Analyzed ${result.pages} ${result.pages === 1 ? "page" : "pages"}: ${sections}.${existing}${overview}`)
        router.refresh()
      } catch {
        setError("Analysis was interrupted. Refresh the page to check the source status, then try again.")
        router.refresh()
      }
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
      <div className="flex flex-wrap gap-2">
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ExternalLink aria-hidden="true" />
            {isPdf ? "View PDF" : "View image"}
          </a>
        )}
        {!archived && (
          <Button variant="outline" size="lg" disabled={processing} onClick={() => setOpen("replace")}>
            <FileUp aria-hidden="true" />
            Replace file
          </Button>
        )}
        {isPdf && !archived && (
          <Button size="lg" disabled={processing} onClick={() => setOpen("analyze")}>
            {processing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {processing ? "Analyzing…" : analyzed ? "Re-analyze with AI" : "Analyze with AI"}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-lg" aria-label="More source actions" />}>
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {archived ? (
              <DropdownMenuItem onClick={() => run(() => restoreDocument(id), "Source restored. Its sections stay Archived until you restore them.")}>
                <ArchiveRestore aria-hidden="true" />
                Restore source
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled={processing} onClick={() => setOpen("archive")}>
                <Archive aria-hidden="true" />
                Archive source
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={processing} onClick={() => setOpen("delete")}>
              <Trash2 aria-hidden="true" />
              Delete source
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {notice && !open && <p role="status" className="max-w-md text-sm text-muted-foreground lg:text-right">{notice}</p>}
      {error && !open && <p role="alert" className="max-w-md text-sm text-destructive lg:text-right">{error}</p>}

      <Dialog open={open === "analyze"} onOpenChange={close}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Analyze document with AI</DialogTitle>
            <DialogDescription>
              Campus Agent will extract and organize this document into reviewable knowledge sections. Nothing will be published automatically.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
            <li>Text is extracted page by page.</li>
            <li>Sections are grouped by topic, and page references are preserved.</li>
            <li>You can edit, delete or publish each section.</li>
            <li>Only Published sections become available to Campus Agent.</li>
            {analyzed && <li>Existing sections — including Published ones — are kept as they are. New topics are added as Drafts.</li>}
          </ul>
          {pending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Analyzing… large documents can take a minute.</p>}
          {error && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            <Button size="lg" disabled={pending} onClick={analyze}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {pending ? "Analyzing…" : "Start analysis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReplaceFileDialog id={id} isPdf={isPdf} open={open === "replace"} onOpenChange={(next) => { if (!next) setOpen(null) }} onDone={(message) => { setOpen(null); setNotice(message); router.refresh() }} />

      <Dialog open={open === "archive"} onOpenChange={close}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Archive “{title}”?</DialogTitle>
            <DialogDescription>
              The source and all of its sections will be archived. Campus Agent and students stop using them right away. Nothing is deleted, and you can restore the source later.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            <Button size="lg" disabled={pending} onClick={() => run(() => archiveDocument(id), "Source archived.")}>{pending ? "Archiving…" : "Archive source"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "delete"} onOpenChange={close}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription>
              {publishedCount > 0
                ? `This source has ${publishedCount} Published ${publishedCount === 1 ? "section" : "sections"} that Campus Agent uses. Move them to Draft or archive the source instead.`
                : `The file${otherSectionCount ? ` and its ${otherSectionCount} Draft/Archived ${otherSectionCount === 1 ? "section" : "sections"}` : ""} will be permanently deleted. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            {publishedCount === 0 && (
              <Button variant="destructive" size="lg" disabled={pending} onClick={() => run(() => deleteDocument(id))}>{pending ? "Deleting…" : "Delete permanently"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReplaceFileDialog({ id, isPdf, open, onOpenChange, onDone }: {
  id: string
  isPdf: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return setError("Choose a file.")
    setBusy(true)
    setError(null)
    let uploadedPath: string | null = null
    try {
      const uploaded = await uploadSourceFile(file)
      if ("error" in uploaded) return setError(uploaded.error)
      uploadedPath = uploaded.filePath
      const result = await replaceSourceFile(id, { filePath: uploaded.filePath, fileName: file.name, fileSize: file.size })
      if (!result.ok) return setError(result.error)
      reset()
      onDone(isPdf ? "File replaced. Existing sections are unchanged — re-analyze to add Draft sections from the new file." : "Image replaced.")
    } catch {
      if (uploadedPath) {
        try { await discardUnregisteredSource(uploadedPath) } catch { /* referenced files are never removed */ }
      }
      setError("The file could not be replaced. The previous file is unchanged.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (busy) return; if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Replace file</DialogTitle>
          <DialogDescription>
            {isPdf
              ? "Upload an updated PDF. Published sections stay available to Campus Agent; re-analyze afterwards to review new or changed topics as Drafts."
              : "Upload an updated PNG or JPG/JPEG image."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="replace-file" className="text-sm font-medium">New file</label>
            <input
              ref={inputRef}
              id="replace-file"
              type="file"
              accept={isPdf ? ".pdf,application/pdf" : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"}
              disabled={busy}
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null
                const problem = selected ? checkSourceFile(selected, isPdf ? "pdf" : "image") : null
                setError(problem)
                setFile(problem ? null : selected)
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
            <Button type="submit" size="lg" disabled={busy || !file}>{busy ? "Uploading…" : "Replace file"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
