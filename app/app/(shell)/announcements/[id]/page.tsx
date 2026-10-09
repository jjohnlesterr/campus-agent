import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { AnnouncementImage } from "@/components/student/announcement-image"
import { scopeLabel } from "@/lib/announcement-scopes"
import { safeSourceUrl } from "@/lib/announcements"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { getPublishedAnnouncement } from "@/lib/campus/published-announcements"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

// One Published announcement: title, date, source, the whole image (never cropped; opens the lightbox),
// full content, and a link to the original official post when there is one.
export default async function AnnouncementPage({ params }: PageProps<"/app/announcements/[id]">) {
  const [, { timezone }, { id }] = await Promise.all([requireProfile(), getBranding(), params])
  if (!z.uuid().safeParse(id).success) notFound()
  const { data: a, error } = await getPublishedAnnouncement(await createClient(), id)
  if (error) throw new Error("This announcement could not be loaded.")
  if (!a) notFound()
  const url = safeSourceUrl(a.source_url)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/app/announcements" className="font-medium text-primary hover:underline">Announcements</Link>
      </nav>

      <article className="overflow-hidden rounded-lg border bg-background">
        {a.image_url && <AnnouncementImage src={a.image_url} title={a.title} />}
        <div className="px-5 py-6 sm:px-8">
          <p className="text-sm text-muted-foreground">
            <time dateTime={a.publish_at}>{formatDate(a.publish_at, timezone, { month: "long", day: "numeric", year: "numeric" })}</time>
            {a.source && <> · {a.source}</>}
            {" · "}{scopeLabel(a.departments?.code ?? null)}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{a.title}</h1>
          <p className="mt-5 leading-relaxed whitespace-pre-line">{a.content}</p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              View original source
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">{a.source ? `: ${a.source}` : ""} (opens in a new tab)</span>
            </a>
          )}
        </div>
      </article>
    </div>
  )
}
