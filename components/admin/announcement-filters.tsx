"use client"

import { Search } from "lucide-react"

import { selectClass } from "@/components/shared/form-field"
import { Input } from "@/components/ui/input"
import { ANNOUNCEMENT_SORTS } from "@/lib/announcements"

/** Date sort + search for Admin › Announcements. A plain GET form; the sort applies on change. */
export function AnnouncementFilters({ tab, sort, query }: { tab: string; sort: string; query: string }) {
  return (
    <form action="/admin/announcements" role="search" className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
      {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
      <label htmlFor="announcement-sort" className="sr-only">Sort by date</label>
      <select
        id="announcement-sort"
        name="sort"
        defaultValue={sort}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${selectClass} h-9 cursor-pointer sm:w-40`}
      >
        {ANNOUNCEMENT_SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <div className="relative w-full sm:w-72">
        <label htmlFor="announcement-search" className="sr-only">Search announcements</label>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="announcement-search" type="search" name="q" defaultValue={query} placeholder="Search announcements…" className="h-9 pl-8" />
      </div>
    </form>
  )
}
