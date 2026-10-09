"use client"

import { Search } from "lucide-react"

import { selectClass } from "@/components/shared/form-field"
import { Input } from "@/components/ui/input"
import { ANNOUNCEMENT_SORTS, type AnnouncementSort } from "@/lib/announcements"

/**
 * Category, sort (manual or by date) + search for Admin › Announcements. Controlled inputs:
 * every change filters the list already on the page instantly — no form submission.
 */
export function AnnouncementFilters({ sort, query, scope, scopeCodes, onSort, onQuery, onScope }: {
  sort: AnnouncementSort
  query: string
  scope: string
  scopeCodes: readonly string[]
  onSort: (sort: AnnouncementSort) => void
  onQuery: (query: string) => void
  onScope: (scope: string) => void
}) {
  const options = [
    { value: "all", label: "All categories" },
    { value: "university", label: "University-wide" },
    ...scopeCodes.map((code) => ({ value: code, label: code })),
  ]
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
      <label htmlFor="announcement-scope" className="sr-only">Category</label>
      <select id="announcement-scope" value={scope} onChange={(e) => onScope(e.target.value)} className={`${selectClass} h-9 cursor-pointer sm:w-40`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <label htmlFor="announcement-sort" className="sr-only">Sort</label>
      <select id="announcement-sort" value={sort} onChange={(e) => onSort(e.target.value as AnnouncementSort)} className={`${selectClass} h-9 cursor-pointer sm:w-40`}>
        {ANNOUNCEMENT_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <div className="relative w-full sm:w-72">
        <label htmlFor="announcement-search" className="sr-only">Search announcements</label>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="announcement-search" type="search" value={query} onChange={(e) => onQuery(e.target.value.slice(0, 100))} placeholder="Search announcements…" className="h-9 pl-8" />
      </div>
    </form>
  )
}
