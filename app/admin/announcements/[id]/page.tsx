import { Archive } from "lucide-react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { archiveAnnouncement, deleteAnnouncement } from "@/app/admin/announcements/actions"
import { AnnouncementForm } from "@/components/admin/announcement-form"
import { DeleteButton } from "@/components/admin/delete-button"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

export default async function EditAnnouncementPage({ params }: PageProps<"/admin/announcements/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const supabase = await createClient()
  const [{ data: announcement }, { timezone }] = await Promise.all([
    supabase.from("announcements").select("id, title, content, publish_at, status, source, source_url").eq("id", id).maybeSingle(),
    getBranding(),
  ])
  if (!announcement) notFound()

  return (
    <>
      <PageHeader
        title="Edit announcement"
        description={announcement.status === "archived" ? "Archived: hidden from users and Campus Agent. Save it as a draft or publish it to restore it." : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={announcement.status} />
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
      <div className="mt-6 max-w-2xl rounded-lg border bg-background p-6">
        <AnnouncementForm
          values={{
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            date: utcIsoToZonedInputs(announcement.publish_at, timezone).date,
            sourceLabel: announcement.source ?? "",
            sourceUrl: announcement.source_url ?? "",
          }}
        />
      </div>
    </>
  )
}
