"use client"

import { cn } from "cn"
import { Library, Loader2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { setGuideStatuses } from "@/app/admin/knowledge/actions"
import { EmptyState } from "@/components/shared/empty-state"
import { selectClass } from "@/components/shared/form-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/datetime"
import type { Tables } from "@/lib/supabase/database.types"

// referenceLabel is computed on the server, so the zod-based reference parser isn't shipped to the browser.
export type LibraryGuide = Pick<Tables<"guidelines">, "id" | "title" | "description" | "status" | "updated_at" | "source_reference"> & {
  referenceLabel: string
  documents: { title: string } | null
  guideline_steps: { count: number }[]
}

type LibraryProps = {
  guides: LibraryGuide[]
  timezone: string
  status: "all" | "draft" | "published"
  sort: "newest" | "oldest" | "az"
  source?: string
  loadError?: boolean
}

export function GuideLibrary(props: LibraryProps) {
  // Changing the visible result scope clears selection, including browser back/forward.
  return <ScopedGuideLibrary key={`${props.status}:${props.sort}:${props.source ?? ""}`} {...props} />
}

function ScopedGuideLibrary({ guides, timezone, status, sort, source, loadError }: LibraryProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [sorting, startSorting] = useTransition()
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const selected = guides.filter(guide => selection.has(guide.id))
  const drafts = selected.filter(guide => guide.status === "draft")
  const published = selected.filter(guide => guide.status === "published")
  const archivedCount = selected.length - drafts.length - published.length
  const hrefFor = (nextStatus: string, nextSort = sort, includeSource = true) => {
    const query = new URLSearchParams({ status: nextStatus, sort: nextSort })
    if (source && includeSource) query.set("source", source)
    return `${pathname}?${query}`
  }
  const toggle = (id: string) => {
    setFeedback(null)
    setSelection(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const changeStatus = (intent: "draft" | "published") => {
    const eligible = intent === "published" ? drafts : published
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await setGuideStatuses(eligible.map(guide => guide.id), intent)
        if (!result.ok) { setFeedback({ error: true, text: result.error }); return }
        const verb = intent === "published" ? "published" : "returned to Draft"
        const text = `${result.updated} ${result.updated === 1 ? "guide" : "guides"} ${verb}.`
        setFeedback({ error: false, text: result.skipped ? `${text} ${result.skipped} skipped because their status changed or they are no longer available.` : text })
        setSelection(new Set())
      } catch {
        setFeedback({ error: true, text: "The request could not be completed. Refresh to check the current statuses before trying again." })
      }
    })
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Guide status" className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
          {([["all", "All"], ["published", "Published"], ["draft", "Draft"]] as const).map(([value, label]) => <Link key={value} href={hrefFor(value)} aria-current={status === value ? "page" : undefined} className={cn("rounded px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", status === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2" aria-busy={sorting}>
          <label htmlFor="guide-sort" className="text-sm text-muted-foreground">Sort</label>
          <select id="guide-sort" value={sort} disabled={pending || sorting} className={`${selectClass} w-auto`} onChange={event => {
            const nextSort = event.target.value as LibraryProps["sort"]
            startSorting(() => router.replace(hrefFor(status, nextSort), { scroll: false }))
          }}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="az">A–Z</option>
          </select>
          {sorting && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Sorting guides" />}
        </div>
      </div>
      {source && <p className="mt-4 text-sm text-muted-foreground">Showing guides from the selected source. <Link href={hrefFor(status, sort, false)} className="text-primary underline">Show all sources</Link></p>}
      {!loadError && guides.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" disabled={pending || selected.length === guides.length} onClick={() => { setSelection(new Set(guides.map(guide => guide.id))); setFeedback(null) }}>Select all</Button>
        <Button variant="ghost" disabled={pending || !selected.length} onClick={() => { setSelection(new Set()); setFeedback(null) }}>Clear selection</Button>
        <span className="text-xs text-muted-foreground">{guides.length} {guides.length === 1 ? "guide" : "guides"} in this view</span>
      </div>}
      {!loadError && selected.length > 0 && <div role="region" aria-label="Bulk publishing" aria-busy={pending} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
        <div>
          <p className="text-sm font-semibold" aria-live="polite">{selected.length} selected</p>
          {drafts.length > 0 && published.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{drafts.length} Draft, {published.length} Published. Each action affects only its matching status.</p>}
          {archivedCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{archivedCount} archived {archivedCount === 1 ? "guide is" : "guides are"} excluded from publishing actions.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending && <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Updating statuses…</span>}
          {drafts.length > 0 && <Button disabled={pending} onClick={() => changeStatus("published")}>Publish selected ({drafts.length})</Button>}
          {published.length > 0 && <Button variant="outline" disabled={pending} onClick={() => changeStatus("draft")}>Unpublish selected ({published.length})</Button>}
        </div>
      </div>}
      {feedback && <p role={feedback.error ? "alert" : "status"} className={cn("mt-4 text-sm", feedback.error ? "text-destructive" : "text-muted-foreground")}>{feedback.text}</p>}
      {loadError ? <p role="alert" className="mt-6 text-sm text-destructive">Guides could not be loaded. Please refresh this page.</p> : guides.length ? (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Guides">
          {guides.map(guide => <li key={guide.id} className={cn("group relative flex flex-col rounded-lg border bg-background p-6 transition-colors hover:border-primary/40", selection.has(guide.id) && "border-primary/50 bg-accent/20")}>
            <Link href={`/admin/knowledge/${guide.id}`} aria-label={`Review / Edit ${guide.title}`} className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <label className="relative z-20 -m-2 flex min-h-10 min-w-10 cursor-pointer items-center justify-center p-2">
                  <input type="checkbox" aria-label={`Select ${guide.title}`} checked={selection.has(guide.id)} disabled={pending} onChange={() => toggle(guide.id)} className="size-4 cursor-pointer accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait" />
                </label>
                <StatusBadge status={guide.status} />
              </div>
              <span className="text-xs text-muted-foreground">Updated <time dateTime={guide.updated_at}>{formatDate(guide.updated_at, timezone, { month: "short", day: "numeric", year: "numeric" })}</time></span>
            </div>
            <h2 className="mt-4 text-lg leading-snug font-semibold group-hover:text-primary">{guide.title}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{guide.description || "Review this guide and add a short description."}</p>
            <div className="mt-5 flex flex-1 flex-col justify-end gap-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{guide.documents?.title ?? "Source unavailable"} · {guide.referenceLabel}</p>
              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <span className="text-xs text-muted-foreground">{guide.guideline_steps[0]?.count ? `${guide.guideline_steps[0].count} steps` : "Information guide"}</span>
                <Link href={`/admin/knowledge/${guide.id}`} className={cn(buttonVariants({ variant: "outline" }), "relative z-20")}>Review / Edit</Link>
              </div>
            </div>
          </li>)}
        </ul>
      ) : <div className="mt-6 rounded-lg border bg-background"><EmptyState icon={Library} title={status === "all" ? "No guides yet." : `No ${status} guides.`} description={status === "published" ? "Publish Draft guides to make them available to students." : "Open a Ready text source and choose Create Knowledge Base guides to prepare drafts for review."}><Link href="/admin/documents" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Open Sources</Link></EmptyState></div>}
    </>
  )
}
