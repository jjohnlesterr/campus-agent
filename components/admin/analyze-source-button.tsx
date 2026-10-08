"use client"

import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { analyzeDocument } from "@/app/admin/documents/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Analyze / Re-analyze with AI for a PDF source (Organize with AI for a text source), shown in the source's
 * Knowledge status section. It creates Draft sections and reports the outcome below the button.
 */
export function AnalyzeSourceButton({ id, format, analyzed, processing }: {
  id: string
  format: "pdf" | "text"
  analyzed: boolean
  processing: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const pdf = format === "pdf"
  const verb = pdf ? "Analyze" : "Organize"
  const where = pdf ? "the PDF" : "the text"
  // "Analyzing" / "Re-analyzing" (or "Organizing" for a text source).
  const running = analyzed ? `Re-${verb.toLowerCase().slice(0, -1)}ing` : `${verb.slice(0, -1)}ing`
  const cancelRef = useRef<HTMLButtonElement>(null)

  function close(next: boolean) {
    if (pending) return
    if (!next) { setOpen(false); setError(null) }
  }

  function analyze() {
    if (pending) return // one run at a time
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await analyzeDocument(id)
        if (!result.ok) return setError(result.error)
        setOpen(false)
        const sections = result.created === 1 ? "1 new Draft section" : `${result.created} new Draft sections`
        const refreshed = result.refreshed ? ` ${result.refreshed} unedited draft ${result.refreshed === 1 ? "section was" : "sections were"} updated from ${where}.` : ""
        const tables = result.tableReviews ? ` ${result.tableReviews} ${result.tableReviews === 1 ? "section has a table" : "sections have tables"} kept as source text — check ${result.tableReviews === 1 ? "it" : "them"} against ${where}.` : ""
        const existing = result.skipped ? ` ${result.skipped} existing ${result.skipped === 1 ? "section was" : "sections were"} left unchanged.` : ""
        const overview = !result.outlined
          ? ` AI structure detection is unavailable right now; sections were created from ${pdf ? "the document's" : "the text's"} detected headings.`
          : result.overview ? "" : " The AI overview and section summaries are unavailable right now."
        const edited = result.staleEdited ? ` ${result.staleEdited} edited draft ${result.staleEdited === 1 ? "section is" : "sections are"} no longer in ${where} and ${result.staleEdited === 1 ? "was" : "were"} kept as ${result.staleEdited === 1 ? "it is" : "they are"}; review ${result.staleEdited === 1 ? "it" : "them"}.` : ""
        const archived = result.archivedStale ? ` ${result.archivedStale} draft ${result.archivedStale === 1 ? "section is" : "sections are"} no longer in ${where} and ${result.archivedStale === 1 ? "was" : "were"} archived.` : ""
        const stale = result.stalePublished ? ` ${result.stalePublished} published ${result.stalePublished === 1 ? "section is" : "sections are"} no longer in ${where}; review ${result.stalePublished === 1 ? "it" : "them"} at the end of the list.` : ""
        setMessage({ error: false, text: `${pdf ? `Analyzed ${result.pages} ${result.pages === 1 ? "page" : "pages"}` : "Organized the text"}: ${sections}.${refreshed}${tables}${existing}${archived}${edited}${stale}${overview}` })
        router.refresh()
      } catch {
        // Existing sections are only changed once analysis succeeds; the dialog stays open to retry.
        setError(`${verb} with AI was interrupted. Published and edited sections were not changed. Try again, or refresh the page to check the source status.`)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button size="lg" disabled={processing || pending} onClick={() => setOpen(true)}>
        {processing || pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
        {processing || pending ? `${verb.slice(0, -1)}ing…` : analyzed ? `Re-${verb.toLowerCase()} with AI` : `${verb} with AI`}
      </Button>
      <div aria-live="polite">
        {message && (
          <p role={message.error ? "alert" : "status"} className={`max-w-sm text-sm sm:text-right ${message.error ? "text-destructive" : "text-muted-foreground"}`}>
            {message.text}
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={close}>
        {/* Cancel is focused first: the safe choice. */}
        <DialogContent className="sm:max-w-lg" showCloseButton={!pending} initialFocus={cancelRef}>
          {analyzed ? (
            <>
              <DialogHeader>
                <DialogTitle>Re-{verb.toLowerCase()} this source?</DialogTitle>
                <DialogDescription>
                  Campus Agent will {verb.toLowerCase()} {where} again and generate updated knowledge sections as Drafts. Nothing will be published automatically.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed">
                Published and manually edited sections will be preserved. Existing AI-generated drafts that you have not edited may be replaced with the updated text, or archived if their topic is no longer in {where}.
              </p>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>The source file, its title and description, and sections you added yourself are not changed. Only the AI overview is refreshed.</li>
                <li>Page references and citations of preserved sections stay as they are.</li>
                <li>If it fails, you will see an error and can try again. Published and edited sections are never changed.</li>
              </ul>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{pdf ? "Analyze document with AI" : "Organize text with AI"}</DialogTitle>
                <DialogDescription>
                  Campus Agent will {pdf ? "extract and organize this document" : "organize this text"} into reviewable knowledge sections. Nothing will be published automatically.
                </DialogDescription>
              </DialogHeader>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
                {pdf ? (
                  <>
                    <li>Text is extracted page by page.</li>
                    <li>Sections are grouped by topic, and page references are preserved.</li>
                  </>
                ) : (
                  <>
                    <li>Sections are split at headings (lines like “## Late enrollment” or short ALL-CAPS titles).</li>
                    <li>Your original text is kept unchanged.</li>
                  </>
                )}
                <li>You can edit, delete or publish each section.</li>
                <li>Only Published sections become available to Campus Agent.</li>
              </ul>
            </>
          )}
          {pending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{running}… large {pdf ? "documents" : "texts"} can take a minute.</p>}
          {error && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p>}
          <DialogFooter>
            <Button ref={cancelRef} variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            <Button size="lg" disabled={pending} aria-busy={pending} onClick={analyze}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {pending ? `${running}…` : analyzed ? `Re-${verb.toLowerCase()} source` : pdf ? "Start analysis" : "Organize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
