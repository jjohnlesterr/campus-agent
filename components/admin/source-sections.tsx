"use client"

import { cn } from "cn"
import { GripVertical, Loader2, MoreHorizontal, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { addSourceSection, deleteGuide, reorderSourceSections, saveSectionText, setGuideArchived, setGuideStatuses } from "@/app/admin/knowledge/actions"
import { useDragOrder } from "@/components/admin/use-drag-order"
import { textareaClass } from "@/components/shared/form-field"
import { SourceText } from "@/components/shared/source-text"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type SourceSection, formatPageList, parsePageList } from "@/lib/knowledge/sections"

type Result = { ok: true } | { ok: false; error: string }
type Feedback = { error: boolean; text: string } | null

/**
 * A source's knowledge sections, listed in page order: "1. Title", its pages, status
 * and text. Each section is reviewed, edited and published on its own; archived
 * sections are tucked away.
 */
export function SourceSections({
  documentId,
  sections,
  overview,
  emptyMessage,
  canAdd,
  format,
}: {
  documentId: string
  sections: SourceSection[]
  overview: { summary: string; topics: string[] } | null
  emptyMessage: string
  canAdd: boolean
  /** PDF sections cite pages; text-source sections are cited by the source title. */
  format: "pdf" | "text"
}) {
  const original = format === "pdf" ? "PDF" : "text"
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [deleting, setDeleting] = useState<SourceSection | null>(null)

  const active = sections.filter((s) => s.status !== "archived")
  const archived = sections.filter((s) => s.status === "archived")
  const drafts = active.filter((s) => s.status === "draft")
  const published = active.length - drafts.length
  const shown = showArchived ? sections : active

  // Drag-and-drop order. Hidden archived sections keep their place after the visible ones.
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderAnnouncement, setOrderAnnouncement] = useState("")
  const byId = new Map(sections.map((s) => [s.id, s]))
  const drag = useDragOrder(shown.map((s) => s.id), (ids, movedId, revert) => {
    setFeedback(null)
    setSavingOrder(true)
    setOrderAnnouncement(`“${byId.get(movedId)?.title ?? "Section"}” moved to position ${ids.indexOf(movedId) + 1} of ${ids.length}.`)
    const all = showArchived ? ids : [...ids, ...archived.map((s) => s.id)]
    const failed = (text: string) => { revert(); setFeedback({ error: true, text }) }
    reorderSourceSections({ documentId, ids: all })
      .then((result) => (result.ok ? router.refresh() : failed(result.error)))
      .catch(() => failed("The new order could not be saved. Refresh the page and try again."))
      .finally(() => setSavingOrder(false))
  })
  const ordered = drag.order.flatMap((id) => byId.get(id) ?? [])
  const canReorder = !pending && editing === null && ordered.length > 1

  function run(action: () => Promise<Result>, success: string, after?: () => void) {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setFeedback({ error: true, text: result.error })
        after?.()
        setFeedback({ error: false, text: success })
        router.refresh()
      } catch {
        setFeedback({ error: true, text: "The request could not be completed. Refresh the page and try again." })
      }
    })
  }

  const setStatuses = async (ids: string[], intent: "draft" | "published"): Promise<Result> => {
    const result = await setGuideStatuses(ids, intent)
    return result.ok ? { ok: true } : result
  }

  return (
    <section aria-labelledby="sections-heading" className="mt-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 id="sections-heading" className="text-lg font-semibold">Knowledge Sections</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {format === "pdf" ? "Extracted from this PDF" : "Organized from this text"}. Review each section against the original, edit it if needed, then publish. Only Published sections are used by Campus Agent.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canAdd && (
            <Button variant="outline" size="lg" disabled={pending || editing !== null} onClick={() => { setFeedback(null); setEditing("new") }}>
              Add section
            </Button>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {pending && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Saving…</p>}
        {savingOrder && !pending && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Saving order…</p>}
        <p className="sr-only">{orderAnnouncement}</p>
        <p id="reorder-hint" className="sr-only">Drag a section by its handle, or focus the handle and use the Up and Down arrow keys, to change the order.</p>
        {feedback && !pending && <p role={feedback.error ? "alert" : "status"} className={cn("mt-3 text-sm", feedback.error ? "text-destructive" : "text-muted-foreground")}>{feedback.text}</p>}
      </div>

      <div className="mt-4 rounded-lg border bg-background">
        {sections.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground">
              {active.length} {active.length === 1 ? "section" : "sections"} · {published} published · {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
              {archived.length > 0 && (
                <>
                  {" · "}
                  <button type="button" onClick={() => setShowArchived((v) => !v)} className="cursor-pointer rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {showArchived ? "Hide" : "Show"} {archived.length} archived
                  </button>
                </>
              )}
            </p>
            {drafts.length > 0 && (
              <Button size="sm" disabled={pending} onClick={() => setConfirmPublish(true)}>
                Publish drafts ({drafts.length})
              </Button>
            )}
          </div>
        )}

        <div className="w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {overview && (
            <div className="mb-6 border-b pb-6">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Overview</h3>
              <p className="mt-2 leading-relaxed lg:max-w-[85%]">{overview.summary}</p>
              {overview.topics.length > 0 && <p className="mt-2 text-sm text-muted-foreground lg:max-w-[85%]"><span className="font-medium text-foreground">Key topics:</span> {overview.topics.join(", ")}</p>}
              <p className="mt-2 text-xs text-muted-foreground">AI-generated summary for admins. It is not used to answer students.</p>
            </div>
          )}

          {editing === "new" && (
            <SectionEditor
              formId="new"
              heading="New section"
              initial={{ title: "", content: "", pages: [] }}
              paged={format === "pdf"}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSave={(values) => run(() => addSourceSection({ documentId, ...values }), "Section added as Draft.", () => setEditing(null))}
            />
          )}

          {shown.length === 0 && editing !== "new" ? (
            <p className="py-6 text-center text-sm leading-relaxed text-muted-foreground">{emptyMessage}</p>
          ) : (
            <ol className="flex flex-col divide-y" aria-label="Knowledge sections" aria-describedby="reorder-hint">
              {ordered.map((section, index) => (
                <li key={section.id} ref={drag.itemRef(section.id)} className={cn("py-6 first:pt-0 last:pb-0", drag.dragging === section.id && "relative z-10 rounded-md bg-muted/60 shadow-sm ring-1 ring-border")}>
                  {editing === section.id ? (
                    <SectionEditor
                      formId={section.id}
                      heading={`Edit section ${index + 1}`}
                      initial={section}
                      paged={format === "pdf"}
                      hint={section.status === "published" ? "This section is Published: your changes are used in answers as soon as you save." : undefined}
                      fullEditorId={section.steps.length + section.requirements.length > 0 ? section.id : undefined}
                      pending={pending}
                      onCancel={() => setEditing(null)}
                      onSave={(values) => run(() => saveSectionText({ id: section.id, updatedAt: section.updatedAt, ...values }), "Section saved.", () => setEditing(null))}
                    />
                  ) : (
                    <SectionView
                      section={section}
                      paged={format === "pdf"}
                      number={index + 1}
                      handle={
                        <button
                          type="button"
                          aria-label={`Reorder “${section.title}”, position ${index + 1} of ${ordered.length}`}
                          title="Drag to reorder"
                          disabled={!canReorder}
                          className={cn(
                            "-ml-1.5 flex h-6 w-5 shrink-0 touch-none items-center justify-center rounded text-muted-foreground/60 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
                            drag.dragging === section.id ? "cursor-grabbing text-foreground" : "cursor-grab"
                          )}
                          {...drag.handleProps(section.id, !canReorder)}
                        >
                          <GripVertical className="size-4" aria-hidden="true" />
                        </button>
                      }
                      pending={pending || editing !== null}
                      onEdit={() => { setFeedback(null); setEditing(section.id) }}
                      onPublish={() => run(() => setStatuses([section.id], "published"), `“${section.title}” published.`)}
                      onUnpublish={() => run(() => setStatuses([section.id], "draft"), `“${section.title}” moved to Draft.`)}
                      onArchive={(archive) => run(() => setGuideArchived(section.id, archive), archive ? `“${section.title}” archived.` : `“${section.title}” restored as Draft.`)}
                      onDelete={() => setDeleting(section)}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <Dialog open={confirmPublish} onOpenChange={(next) => { if (!pending) setConfirmPublish(next) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Publish {drafts.length} draft {drafts.length === 1 ? "section" : "sections"}?</DialogTitle>
            <DialogDescription>
              Confirm you have reviewed {drafts.length === 1 ? "it" : "them"} against the original {original}. Published sections are used by Campus Agent to answer students. You can move a section back to Draft at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setConfirmPublish(false)}>Cancel</Button>
            <Button size="lg" disabled={pending} onClick={() => run(() => setStatuses(drafts.map((s) => s.id), "published"), `${drafts.length} ${drafts.length === 1 ? "section" : "sections"} published.`, () => setConfirmPublish(false))}>
              {pending ? "Publishing…" : "I’ve reviewed them — publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(next) => { if (!next && !pending) setDeleting(null) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete this section?</DialogTitle>
            <DialogDescription>“{deleting?.title}” will be permanently deleted. The original {original} is not affected. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending} onClick={() => deleting && run(() => deleteGuide(deleting.id), "Section deleted.", () => setDeleting(null))}>
              {pending ? "Deleting…" : "Delete section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function SectionView({ section, paged, number, handle, pending, onEdit, onPublish, onUnpublish, onArchive, onDelete }: {
  section: SourceSection
  paged: boolean
  number: number
  /** Drag handle for reordering, shown before the title. */
  handle: React.ReactNode
  pending: boolean
  onEdit: () => void
  onPublish: () => void
  onUnpublish: () => void
  onArchive: (archive: boolean) => void
  onDelete: () => void
}) {
  const router = useRouter()
  return (
    <article aria-labelledby={`section-${section.id}`} className={cn(section.status === "archived" && "opacity-70")}>
      <div className="flex w-full items-start justify-between gap-3">
        {handle}
        <div className="min-w-0 flex-1">
          <h3 id={`section-${section.id}`} className="font-semibold break-words">
            <span className="text-muted-foreground tabular-nums">{number}.</span> {section.title}
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {paged && <span>{section.pageLabel}</span>}
            <StatusBadge status={section.status} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {section.status !== "archived" && <Button variant="ghost" size="sm" disabled={pending} onClick={onEdit}>Edit<span className="sr-only"> {section.title}</span></Button>}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${section.title}`} disabled={pending} />}>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              {section.status === "draft" && <DropdownMenuItem onClick={onPublish}>Publish</DropdownMenuItem>}
              {section.status === "published" && <DropdownMenuItem onClick={onUnpublish}>Move to Draft</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => router.push(`/admin/knowledge/${section.id}`)}>Open full editor</DropdownMenuItem>
              {section.status === "archived"
                ? <DropdownMenuItem onClick={() => onArchive(false)}>Restore as Draft</DropdownMenuItem>
                : <DropdownMenuItem onClick={() => onArchive(true)}>Archive</DropdownMenuItem>}
              {section.status !== "published" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>Delete</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Text spans the card; on large screens it stops at ~85% so lines stay readable. */}
      {section.tableReview && section.status !== "archived" && (
        <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 lg:max-w-[85%]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          A table in this section could not be rebuilt exactly, so it is shown as the source text. Check it against the PDF before publishing.
        </p>
      )}
      {section.content
        ? <SourceText text={section.content} className="mt-3 leading-relaxed lg:max-w-[85%]" />
        : <p className="mt-3 text-sm text-muted-foreground">No text yet. Edit this section to add it.</p>}

      {section.requirements.length > 0 && (
        <div className="mt-4 lg:max-w-[85%]">
          <h4 className="text-sm font-medium">Requirements</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">{section.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      {section.steps.length > 0 && (
        <div className="mt-4 lg:max-w-[85%]">
          <h4 className="text-sm font-medium">Steps</h4>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            {section.steps.map((step, i) => <li key={i}><span className="font-medium">{step.title}</span>{step.description && <span className="text-muted-foreground"> — {step.description}</span>}</li>)}
          </ol>
        </div>
      )}
    </article>
  )
}

function SectionEditor({ formId, heading, initial, paged, hint, fullEditorId, pending, onCancel, onSave }: {
  /** Unique per editor, for label/input ids. */
  formId: string
  heading: string
  initial: { title: string; content: string; pages: number[] }
  /** Show the PDF pages field (text sources have no pages). */
  paged: boolean
  hint?: string
  /** Section id when it also has steps or requirements, which are edited in the full editor. */
  fullEditorId?: string
  pending: boolean
  onCancel: () => void
  onSave: (values: { title: string; content: string; pages: number[] }) => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [pagesText, setPagesText] = useState(formatPageList(initial.pages))
  const [content, setContent] = useState(initial.content)
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const pages = parsePageList(pagesText)
    if (!pages) return setError("Enter page numbers like 4, 5 or 4-6.")
    if (title.trim().length < 2) return setError("Enter a title (at least 2 characters).")
    if (!content.trim()) return setError("Add the section text.")
    setError(null)
    onSave({ title: title.trim(), content: content.trim(), pages })
  }

  return (
    <form onSubmit={submit} aria-label={heading} className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4 sm:p-5">
      <p className="text-sm font-semibold">{heading}</p>
      <div className={cn("grid gap-4", paged && "sm:grid-cols-[minmax(0,1fr)_10rem]")}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`section-title-${formId}`}>Title</Label>
          <Input id={`section-title-${formId}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className="h-9 bg-background" autoFocus />
        </div>
        {paged && <div className="flex flex-col gap-2">
          <Label htmlFor={`section-pages-${formId}`}>PDF pages</Label>
          <Input id={`section-pages-${formId}`} value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="e.g. 4, 5" inputMode="numeric" className="h-9 bg-background" aria-describedby={`section-pages-hint-${formId}`} />
          <p id={`section-pages-hint-${formId}`} className="text-xs text-muted-foreground">Cited in answers.</p>
        </div>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`section-content-${formId}`}>Text</Label>
        <textarea id={`section-content-${formId}`} value={content} onChange={(e) => setContent(e.target.value)} maxLength={20000} required className={cn(textareaClass, "min-h-48 bg-background leading-relaxed field-sizing-content")} />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {fullEditorId && (
        <p className="text-xs text-muted-foreground">
          Steps and requirements are edited in the{" "}
          <Link href={`/admin/knowledge/${fullEditorId}`} className="font-medium text-primary underline-offset-4 hover:underline">full editor</Link>.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save section"}</Button>
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
