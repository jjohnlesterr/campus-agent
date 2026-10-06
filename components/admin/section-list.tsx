"use client"

import { cn } from "cn"
import { Archive, ArchiveRestore, CircleCheck, FileText, Loader2, MoreHorizontal, PenLine, Search, Trash2, Undo2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { deleteGuide, setGuideArchived, setGuideStatuses, unpublishGuide } from "@/app/admin/knowledge/actions"
import { EmptyState } from "@/components/shared/empty-state"
import { selectClass } from "@/components/shared/form-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/datetime"

export type SectionRow = {
  id: string
  title: string
  status: "draft" | "published" | "archived"
  category: string | null
  pages: number[]
  pageLabel: string
  updatedAt: string
}

type StatusFilter = "all" | "published" | "draft" | "archived"
type Result = { ok: true } | { ok: false; error: string }

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
]

export function SectionList({ sections, timezone }: { sections: SectionRow[]; timezone: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<"page" | "title">("page")
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const [deleting, setDeleting] = useState<SectionRow | null>(null)

  const categories = useMemo(() => [...new Set(sections.flatMap((s) => (s.category ? [s.category] : [])))].sort(), [sections])
  const counts = useMemo(() => ({
    all: sections.length,
    published: sections.filter((s) => s.status === "published").length,
    draft: sections.filter((s) => s.status === "draft").length,
    archived: sections.filter((s) => s.status === "archived").length,
  }), [sections])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sections
      .filter((s) => (status === "all" || s.status === status) && (!category || s.category === category) && (!q || s.title.toLowerCase().includes(q)))
      .sort((a, b) => sort === "title"
        ? a.title.localeCompare(b.title)
        : (a.pages[0] ?? Infinity) - (b.pages[0] ?? Infinity) || a.title.localeCompare(b.title))
  }, [sections, query, category, status, sort])

  const selectable = visible.filter((s) => s.status !== "archived")
  const selected = visible.filter((s) => selection.has(s.id))
  const drafts = selected.filter((s) => s.status === "draft")
  const published = selected.filter((s) => s.status === "published")

  // Changing what is visible clears the selection, so bulk actions only touch what you see.
  const changeView = (apply: () => void) => { apply(); setSelection(new Set()); setFeedback(null) }

  function toggle(id: string) {
    setFeedback(null)
    setSelection((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function bulk(intent: "draft" | "published") {
    const eligible = intent === "published" ? drafts : published
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await setGuideStatuses(eligible.map((s) => s.id), intent)
        if (!result.ok) return setFeedback({ error: true, text: result.error })
        const verb = intent === "published" ? "published" : "moved to Draft"
        const text = `${result.updated} ${result.updated === 1 ? "section" : "sections"} ${verb}.`
        setFeedback({ error: false, text: result.skipped ? `${text} ${result.skipped} skipped because their status changed.` : text })
        setSelection(new Set())
        router.refresh()
      } catch {
        setFeedback({ error: true, text: "The request could not be completed. Refresh to check the current statuses before trying again." })
      }
    })
  }

  function rowAction(action: () => Promise<Result>, success: string, after?: () => void) {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setFeedback({ error: true, text: result.error })
        after?.()
        setFeedback({ error: false, text: success })
        router.refresh()
      } catch {
        setFeedback({ error: true, text: "The request could not be completed. Please try again." })
      }
    })
  }

  if (sections.length === 0) {
    return (
      <div className="mt-4 rounded-lg border bg-background p-2">
        <EmptyState icon={FileText} title="No knowledge sections yet." description="Analyze this source with AI to extract reviewable Draft sections. Nothing is published automatically." />
      </div>
    )
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label="Section status" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => changeView(() => setStatus(value))}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                status === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">{counts[value]}</span>
            </button>
          ))}
        </nav>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative">
            <label htmlFor="section-search" className="sr-only">Search sections</label>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="section-search" type="search" value={query} onChange={(e) => changeView(() => setQuery(e.target.value))} placeholder="Search sections" className="h-8 pl-8 sm:w-56" />
          </div>
          <label className="sr-only" htmlFor="section-category">Category</label>
          <select id="section-category" value={category} onChange={(e) => changeView(() => setCategory(e.target.value))} className={cn(selectClass, "sm:w-44")}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="sr-only" htmlFor="section-sort">Sort</label>
          <select id="section-sort" value={sort} onChange={(e) => setSort(e.target.value === "title" ? "title" : "page")} className={cn(selectClass, "sm:w-36")}>
            <option value="page">Sort by page</option>
            <option value="title">Sort by title</option>
          </select>
        </div>
      </div>

      {selected.length > 0 && (
        <div role="region" aria-label="Bulk publishing" aria-busy={pending} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-2.5">
          <p className="text-sm font-medium" aria-live="polite">{selected.length} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            {drafts.length > 0 && <Button disabled={pending} onClick={() => bulk("published")}>Publish selected ({drafts.length})</Button>}
            {published.length > 0 && <Button variant="outline" disabled={pending} onClick={() => bulk("draft")}>Move to Draft ({published.length})</Button>}
            <Button variant="ghost" disabled={pending} onClick={() => setSelection(new Set())}>Clear</Button>
          </div>
        </div>
      )}
      {pending && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Updating…</p>}
      {feedback && !pending && <p role={feedback.error ? "alert" : "status"} className={cn("mt-3 text-sm", feedback.error ? "text-destructive" : "text-muted-foreground")}>{feedback.text}</p>}

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-background px-5 py-8 text-center text-sm text-muted-foreground">No sections match these filters.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border bg-background">
          <div className="hidden grid-cols-[2rem_minmax(0,1fr)_10rem_7rem_6.5rem_7rem_5.5rem] items-center gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <label className="flex items-center justify-center">
              <span className="sr-only">Select all visible sections</span>
              <input type="checkbox" className="size-4 accent-primary" checked={selectable.length > 0 && selected.length === selectable.length} disabled={pending || !selectable.length} onChange={(e) => setSelection(e.target.checked ? new Set(selectable.map((s) => s.id)) : new Set())} />
            </label>
            <span>Title</span><span>Category</span><span>Page</span><span>Status</span><span>Updated</span><span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y" aria-label="Knowledge sections">
            {visible.map((s) => (
              <li key={s.id} className={cn("grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[2rem_minmax(0,1fr)_10rem_7rem_6.5rem_7rem_5.5rem]", selection.has(s.id) && "bg-accent/30")}>
                <label className="row-span-2 flex items-center justify-center md:row-span-1">
                  <span className="sr-only">Select {s.title}</span>
                  <input type="checkbox" className="size-4 accent-primary" checked={selection.has(s.id)} disabled={pending || s.status === "archived"} onChange={() => toggle(s.id)} />
                </label>
                <Link href={`/admin/knowledge/${s.id}`} className="min-w-0 truncate font-medium outline-none hover:text-primary hover:underline focus-visible:underline" title={s.title}>
                  {s.title}
                </Link>
                <span className="truncate text-sm text-muted-foreground max-md:hidden">{s.category ?? "—"}</span>
                <span className="text-sm text-muted-foreground tabular-nums max-md:hidden">{s.pageLabel}</span>
                <span className="max-md:hidden"><StatusBadge status={s.status} /></span>
                <span className="text-sm text-muted-foreground tabular-nums max-md:hidden">
                  <time dateTime={s.updatedAt}>{formatDate(s.updatedAt, timezone, { month: "short", day: "numeric" })}</time>
                </span>
                <div className="row-span-2 flex items-center justify-end gap-1 md:row-span-1">
                  <Link href={`/admin/knowledge/${s.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-sm:hidden")}>
                    {s.status === "draft" ? "Review" : "View"}<span className="sr-only"> {s.title}</span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.title}`} disabled={pending} />}>
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-auto min-w-44">
                      <DropdownMenuItem onClick={() => router.push(`/admin/knowledge/${s.id}`)}><PenLine aria-hidden="true" />Review / Edit</DropdownMenuItem>
                      {s.status === "draft" && <DropdownMenuItem onClick={() => router.push(`/admin/knowledge/${s.id}#publish`)}><CircleCheck aria-hidden="true" />Review and publish</DropdownMenuItem>}
                      {s.status === "published" && <DropdownMenuItem onClick={() => rowAction(() => unpublishGuide(s.id), `“${s.title}” moved to Draft.`)}><Undo2 aria-hidden="true" />Move to Draft</DropdownMenuItem>}
                      {s.status === "archived"
                        ? <DropdownMenuItem onClick={() => rowAction(() => setGuideArchived(s.id, false), `“${s.title}” restored as Draft.`)}><ArchiveRestore aria-hidden="true" />Restore as Draft</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => rowAction(() => setGuideArchived(s.id, true), `“${s.title}” archived.`)}><Archive aria-hidden="true" />Archive</DropdownMenuItem>}
                      {s.status !== "published" && <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(s)}><Trash2 aria-hidden="true" />Delete</DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground md:hidden">
                  <StatusBadge status={s.status} />
                  <span>{s.pageLabel}</span>
                  {s.category && <span>· {s.category}</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(next) => { if (!next && !pending) setDeleting(null) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete this section?</DialogTitle>
            <DialogDescription>“{deleting?.title}” will be permanently deleted. The original source file is not affected. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending} onClick={() => deleting && rowAction(() => deleteGuide(deleting.id), "Section deleted.", () => setDeleting(null))}>
              {pending ? "Deleting…" : "Delete section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
