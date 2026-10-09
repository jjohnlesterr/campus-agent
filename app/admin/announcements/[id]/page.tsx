import { Archive, ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { archiveAnnouncement, deleteAnnouncement } from "@/app/admin/announcements/actions"
import { AnnouncementForm } from "@/components/admin/announcement-form"
import { DeleteButton } from "@/components/admin/delete-button"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { safeSourceUrl, sourceLabelPlaceholder } from "@/lib/announcements"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"
import { getAnnouncementScopes } from "@/lib/campus/announcement-scopes"
import { createClient } from "@/lib/supabase/server"

export default async function EditAnnouncementPage({ params }: PageProps<"/admin/announcements/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const supabase = await createClient()
  const [{ data: announcement }, { timezone, universityName }, scopes] = await Promise.all([
    supabase.from("announcements").select("id, title, content, publish_at, status, source, source_url, image_url, image_position_x, image_position_y, department_id").eq("id", id).maybeSingle(),
    getBranding(),
    getAnnouncementScopes(supabase),
  ])
  if (!announcement) notFound()
  const sourceUrl = safeSourceUrl(announcement.source_url)

  return (
    <>
      <PageHeader
        title="Edit announcement"
        description={announcement.status === "archived" ? "Archived: hidden from users and Campus Agent. Save it as a draft or publish it to restore it." : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Opens the admin-entered link only; nothing is fetched from it. */}
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <ExternalLink aria-hidden="true" />
              View original post
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {announcement.status !== "archived" && (
            <form action={archiveAnnouncement.bind(null, announcement.id)}>
              <Button type="submit" variant="outline" size="lg">
                <Archive aria-hidden="true" />
                Archive
              </Button>
            </form>
          )}
          <DeleteButton action={deleteAnnouncement.bind(null, announcement.id)} label={announcement.title} />
        </div>
      </PageHeader>
      <AnnouncementForm
        values={{
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          date: utcIsoToZonedInputs(announcement.publish_at, timezone).date,
          sourceLabel: announcement.source ?? "",
          sourceUrl: announcement.source_url ?? "",
          imageUrl: announcement.image_url,
          imagePosition: { x: Number(announcement.image_position_x), y: Number(announcement.image_position_y) },
          status: announcement.status,
          departmentId: announcement.department_id,
        }}
        sourcePlaceholder={sourceLabelPlaceholder(universityName)}
        scopes={scopes}
      />
    </>
  )
}
