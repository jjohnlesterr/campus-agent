"use client"

import { cn } from "cn"
import { Megaphone } from "lucide-react"
import { useEffect, useState } from "react"

import { AnnouncementFilters } from "@/components/admin/announcement-filters"
import { type AnnouncementRow, AnnouncementTable } from "@/components/admin/announcement-table"
import type { ImagePosition } from "@/components/admin/image-crop"
import { EmptyState } from "@/components/shared/empty-state"
import { ANNOUNCEMENT_SCOPE_CODES, UNIVERSITY_WIDE, scopeFilter, scopeLabel } from "@/lib/announcement-scopes"
import { ANNOUNCEMENT_TABS, type AnnouncementSort, type AnnouncementTab, filterAnnouncements, sortAnnouncements } from "@/lib/announcements"

/** One announcement as loaded by the page: what the list shows, searches and sorts on. */
export type AnnouncementRecord = {
  id: string
  title: string
  /** Full text, for search; the list shows a one-line preview. */
  content: string
  status: string
  publish_at: string
  created_at: string
  sort_order: number | null
  /** The raw source label (searched), and the short summary the list shows. */
  source: string | null
  sourceSummary: string | null
  sourceUrl: string | null
  dateLabel: string
  imageUrl: string | null
  imagePosition: ImagePosition
  /** Category: null = University-wide, otherwise the department code. Never access control. */
  categoryCode: string | null
}

/**
 * Admin › Announcements list state: status tab, category, sort and search all filter the
 * announcements already loaded — instantly, with no navigation or refetch. The address bar
 * follows along (history.replaceState), so a refresh or shared link keeps the same view.
 */
export function AnnouncementManager({ records, initial }: {
  records: AnnouncementRecord[]
  initial: { tab: AnnouncementTab; sort: AnnouncementSort; query: string; scope: string }
}) {
  const [tab, setTab] = useState(initial.tab)
  const [sort, setSort] = useState(initial.sort)
  const [query, setQuery] = useState(initial.query)
  const [scope, setScope] = useState(initial.scope)

  // Keep the URL in step without navigating (the page is not reloaded or refetched).
  useEffect(() => {
    const search = new URLSearchParams()
    if (tab !== "all") search.set("tab", tab)
    if (sort !== "manual") search.set("sort", sort)
    if (scope !== "all") search.set("scope", scope)
    if (query) search.set("q", query)
    const href = `${window.location.pathname}${search.size ? `?${search}` : ""}`
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href)
  }, [tab, sort, scope, query])

  // The category applies first; status tabs, their counts and search work within it.
  const inCategory = scope === "all" ? records : records.filter((r) => (scope === UNIVERSITY_WIDE ? r.categoryCode === null : r.categoryCode === scope))
  const visible = sortAnnouncements(filterAnnouncements(inCategory, { tab, query }), sort)
  // Drag and drop only where the visible order is the manual order: Manual order, no search.
  const reorderable = sort === "manual" && !query.trim()
  const orderNote = sort !== "manual" ? null : query.trim() ? "Clear the search to reorder announcements." : "Press and hold a row, then drag it to reorder."
  const rows: AnnouncementRow[] = visible.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    date: a.publish_at,
    dateLabel: a.dateLabel,
    source: a.sourceSummary,
    sourceUrl: a.sourceUrl,
    preview: a.content.replace(/\s+/g, " ").trim().slice(0, 240),
    imageUrl: a.imageUrl,
    imagePosition: a.imagePosition,
    scope: scopeLabel(a.categoryCode),
  }))

  return (
    <AnnouncementTable
      rows={rows}
      allIds={sortAnnouncements(records, "manual").map((a) => a.id)}
      reorderable={reorderable}
      orderNote={orderNote}
      filterKey={`${tab}|${sort}|${query}|${scope}`}
      tabs={
        <nav aria-label="Filter by status" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
          {ANNOUNCEMENT_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">{filterAnnouncements(inCategory, { tab: value, query }).length}</span>
            </button>
          ))}
        </nav>
      }
      controls={
        <AnnouncementFilters
          sort={sort}
          query={query}
          scope={scope}
          scopeCodes={ANNOUNCEMENT_SCOPE_CODES}
          onSort={setSort}
          onQuery={setQuery}
          onScope={(value) => setScope(scopeFilter(value))}
        />
      }
      empty={
        <div className="p-2">
          <EmptyState
            icon={Megaphone}
            title={query.trim() ? "No announcements match your search." : records.length ? "Nothing here yet." : "No announcements yet."}
            description={query.trim() ? "Try a different word, or clear the search." : "Create an announcement, or choose another status or category."}
          >
            {query.trim() && (
              <button type="button" onClick={() => setQuery("")} className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                Clear search
              </button>
            )}
          </EmptyState>
        </div>
      }
    />
  )
}
