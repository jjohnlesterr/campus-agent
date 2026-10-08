"use client"

import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { analyzeDocument } from "@/app/admin/documents/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Analyze / Re-analyze with AI for a PDF source, shown in the Knowledge Sections header
 * (it creates the Draft sections listed there). `onMessage` reports the outcome.
 */
export function AnalyzeSourceButton({ id, analyzed, processing, onMessage }: {
  id: string
  analyzed: boolean
  processing: boolean
  onMessage: (message: { error: boolean; text: string }) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function close(next: boolean) {
    if (pending) return
    if (!next) { setOpen(false); setError(null) }
  }

  function analyze() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await analyzeDocument(id)
        if (!result.ok) return setError(result.error)
        setOpen(false)
        const sections = result.created === 1 ? "1 new Draft section" : `${result.created} new Draft sections`
        const existing = result.skipped ? ` ${result.skipped} existing ${result.skipped === 1 ? "section was" : "sections were"} left unchanged.` : ""
        const overview = result.overview ? "" : " The AI overview is unavailable right now; sections were created from the document's headings."
        const archived = result.archivedStale ? ` ${result.archivedStale} draft ${result.archivedStale === 1 ? "section is" : "sections are"} no longer in the PDF and ${result.archivedStale === 1 ? "was" : "were"} archived.` : ""
        const stale = result.stalePublished ? ` ${result.stalePublished} published ${result.stalePublished === 1 ? "section is" : "sections are"} no longer in the PDF; review ${result.stalePublished === 1 ? "it" : "them"} at the end of the list.` : ""
        onMessage({ error: false, text: `Analyzed ${result.pages} ${result.pages === 1 ? "page" : "pages"}: ${sections}.${existing}${archived}${stale}${overview}` })
        router.refresh()
      } catch {
        setOpen(false)
        onMessage({ error: true, text: "Analysis was interrupted. Refresh the page to check the source status, then try again." })
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button size="lg" disabled={processing || pending} onClick={() => setOpen(true)}>
        {processing || pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
        {processing || pending ? "Analyzing…" : analyzed ? "Re-analyze with AI" : "Analyze with AI"}
      </Button>

      <Dialog open={open} onOpenChange={close}>
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
    </>
  )
}
