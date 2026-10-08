import { ExternalLink, Megaphone } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { safeSourceUrl } from "@/lib/announcements"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

// University-wide announcements: Published only, newest first.
export default async function AnnouncementsPage() {
  const [, { timezone }] = await Promise.all([requireProfile(), getBranding()])
  const now = new Date().toISOString()

  const supabase = await createClient()
  const { data: announcements, error } = await supabase
    .from("announcements")
    .select("id, title, content, publish_at, source, source_url")
    .eq("status", "published")
    .lte("publish_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("publish_at", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Announcements" description="Official updates and notices from the university." />

      {error ? (
        <p role="alert" className="mt-5 text-sm text-destructive">Announcements could not be loaded right now. Please try again.</p>
      ) : announcements && announcements.length > 0 ? (
        <ul className="mt-5 divide-y border-y">
          {announcements.map((a) => {
            const url = safeSourceUrl(a.source_url)
            return (
              <li key={a.id} className="py-5">
                <article>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={a.publish_at}>
                      {formatDate(a.publish_at, timezone, { month: "long", day: "numeric", year: "numeric" })}
                    </time>
                  </p>
                  <h2 className="mt-1 font-semibold">{a.title}</h2>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed whitespace-pre-line">{a.content}</p>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      View original source
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">{a.source ? `: ${a.source}` : ""} (opens in a new tab)</span>
                    </a>
                  )}
                  {!url && a.source && <p className="mt-3 text-xs text-muted-foreground">Source: {a.source}</p>}
                </article>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mt-5">
          <EmptyState icon={Megaphone} title="No announcements right now." description="New university announcements will appear here when they are published." />
        </div>
      )}
    </div>
  )
}
