import { cn } from "cn"
import { Megaphone, Plus } from "lucide-react"
import Link from "next/link"

import { AnnouncementFilters } from "@/components/admin/announcement-filters"
import { type AnnouncementRow, AnnouncementTable } from "@/components/admin/announcement-table"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import {
  ANNOUNCEMENT_TABS,
  announcementSort,
  announcementTab,
  filterAnnouncements,
  safeSourceUrl,
  sortAnnouncements,
  sourceSummary,
} from "@/lib/announcements"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

// Admin › Announcements: university-wide notices, sorted by published date. Filtering
// and sorting happen here on the full list (announcements are few; one query).
export default async function AdminAnnouncementsPage({ searchParams }: PageProps<"/admin/announcements">) {
  await requireAdmin()
  const params = await searchParams
  const tab = announcementTab(params.tab)
  const sort = announcementSort(params.sort)
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : ""

  const supabase = await createClient()
  const [{ timezone }, { data, error }] = await Promise.all([
    getBranding(),
    supabase.from("announcements").select("id, title, content, publish_at, created_at, status, source, source_url"),
  ])
  const all = data ?? []
  const visible = sortAnnouncements(filterAnnouncements(all, { tab, query }), sort)
  const rows: AnnouncementRow[] = visible.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    date: a.publish_at,
    dateLabel: formatDate(a.publish_at, timezone, { month: "short", day: "numeric", year: "numeric" }),
    source: sourceSummary(a.source, a.source_url),
    sourceUrl: safeSourceUrl(a.source_url),
  }))

  const hrefFor = (nextTab: string, q = query) => {
    const search = new URLSearchParams()
    if (nextTab !== "all") search.set("tab", nextTab)
    if (sort !== "newest") search.set("sort", sort)
    if (q) search.set("q", q)
    return `/admin/announcements${search.size ? `?${search}` : ""}`
  }

  return (
    <>
      <PageHeader title="Announcements" description="Official university-wide updates and notices for incoming freshmen and visitors.">
        <Link href="/admin/announcements/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          New announcement
        </Link>
      </PageHeader>

      <AnnouncementTable
        rows={error ? [] : rows}
        filterKey={`${tab}|${sort}|${query}`}
        tabs={
          <nav aria-label="Filter by status" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
            {ANNOUNCEMENT_TABS.map(({ value, label }) => {
              const count = filterAnnouncements(all, { tab: value, query }).length
              return (
                <Link
                  key={value}
                  href={hrefFor(value)}
                  aria-current={tab === value ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tab === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                  <span className="text-xs tabular-nums opacity-70">{count}</span>
                </Link>
              )
            })}
          </nav>
        }
        controls={<AnnouncementFilters tab={tab} sort={sort} query={query} />}
        empty={
          error ? (
            <p role="alert" className="p-4 text-sm text-destructive">Announcements could not be loaded. Please refresh this page.</p>
          ) : (
            <div className="p-2">
              <EmptyState
                icon={Megaphone}
                title={query ? "No announcements match your search." : all.length ? "Nothing here yet." : "No announcements yet."}
                description={query ? "Try a different word, or clear the search." : "Create a university-wide announcement for incoming freshmen and visitors."}
              >
                {query && <Link href={hrefFor(tab, "")} className={buttonVariants({ variant: "outline" })}>Clear search</Link>}
              </EmptyState>
            </div>
          )
        }
      />
    </>
  )
}
