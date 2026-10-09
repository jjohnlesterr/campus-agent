import { CircleCheck, Plus } from "lucide-react"
import Link from "next/link"

import { type AnnouncementRecord, AnnouncementManager } from "@/components/admin/announcement-manager"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { announcementSort, announcementTab, safeSourceUrl, sourceSummary } from "@/lib/announcements"
import { scopeFilter } from "@/lib/announcement-scopes"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

// Admin › Announcements: every announcement is loaded once (they are few); the status tab,
// category, sort and search then filter it in the browser, instantly (AnnouncementManager).
// The URL's ?tab, ?sort, ?scope and ?q only set the starting view.
export default async function AdminAnnouncementsPage({ searchParams }: PageProps<"/admin/announcements">) {
  await requireAdmin()
  const params = await searchParams
  // Set by saveAnnouncement after a successful save.
  const saved = params.saved === "published" ? "Announcement published." : params.saved === "draft" ? "Draft saved." : null

  const supabase = await createClient()
  const [{ timezone }, { data, error }] = await Promise.all([
    getBranding(),
    supabase.from("announcements").select("id, title, content, publish_at, created_at, status, source, source_url, image_url, image_position_x, image_position_y, sort_order, departments(code)"),
  ])
  const records: AnnouncementRecord[] = (data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    status: a.status,
    publish_at: a.publish_at,
    created_at: a.created_at,
    sort_order: a.sort_order,
    source: a.source,
    sourceSummary: sourceSummary(a.source, a.source_url),
    sourceUrl: safeSourceUrl(a.source_url),
    dateLabel: formatDate(a.publish_at, timezone, { month: "short", day: "numeric", year: "numeric" }),
    imageUrl: a.image_url,
    imagePosition: { x: Number(a.image_position_x), y: Number(a.image_position_y) },
    categoryCode: a.departments?.code ?? null,
  }))

  return (
    <>
      <PageHeader title="Announcements" description="Official university-wide updates and notices for incoming freshmen and visitors.">
        <Link href="/admin/announcements/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          New announcement
        </Link>
      </PageHeader>

      {saved && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {saved}
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-5 rounded-lg border bg-background p-4 text-sm text-destructive">Announcements could not be loaded. Please refresh this page.</p>
      ) : (
        <AnnouncementManager
          records={records}
          initial={{
            tab: announcementTab(params.tab),
            sort: announcementSort(params.sort),
            query: typeof params.q === "string" ? params.q.slice(0, 100) : "",
            scope: scopeFilter(params.scope),
          }}
        />
      )}
    </>
  )
}
