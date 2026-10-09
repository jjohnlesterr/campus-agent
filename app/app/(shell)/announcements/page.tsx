import { AnnouncementFeed } from "@/components/student/announcement-feed"
import { PageHeader } from "@/components/shared/page-header"
import { ANNOUNCEMENT_SCOPE_CODES, UNIVERSITY_WIDE, scopeFilter } from "@/lib/announcement-scopes"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { pageOfAnnouncements } from "@/lib/campus/published-announcements"
import { createClient } from "@/lib/supabase/server"

const FILTERS = [
  { value: "all", label: "All" },
  { value: UNIVERSITY_WIDE, label: "University-wide" },
  ...ANNOUNCEMENT_SCOPE_CODES.map((code) => ({ value: code, label: code })),
]

// Announcements: Published only, newest first. The first 10 are rendered here; the feed
// loads more on request and switches category in place (no page reload). The category is
// where a notice comes from, never who may see it.
export default async function AnnouncementsPage({ searchParams }: PageProps<"/app/announcements">) {
  const [, { timezone }, params, db] = await Promise.all([requireProfile(), getBranding(), searchParams, createClient()])
  const scope = scopeFilter(params.scope)
  let first: Awaited<ReturnType<typeof pageOfAnnouncements>> | null = null
  try {
    first = await pageOfAnnouncements(db, { scope, offset: 0, timezone })
  } catch {
    first = null
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Announcements" description="Official updates and notices from the university." />
      {first ? (
        <AnnouncementFeed filters={FILTERS} initial={{ scope, ...first }} />
      ) : (
        <p role="alert" className="mt-5 text-sm text-destructive">Announcements could not be loaded right now. Please try again.</p>
      )}
    </div>
  )
}
