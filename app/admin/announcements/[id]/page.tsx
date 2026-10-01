import { notFound } from "next/navigation"

import { deleteAnnouncement } from "@/app/admin/announcements/actions"
import { AnnouncementForm } from "@/components/admin/announcement-form"
import { DeleteButton } from "@/components/admin/delete-button"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"
import { getDepartments } from "@/lib/departments"
import { createClient } from "@/lib/supabase/server"

export default async function EditAnnouncementPage({ params }: PageProps<"/admin/announcements/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const [{ data: announcement }, departments, { timezone }] = await Promise.all([
    supabase.from("announcements").select("*").eq("id", id).maybeSingle(),
    getDepartments(),
    getBranding(),
  ])
  if (!announcement) notFound()

  return (
    <>
      <PageHeader title="Edit announcement">
        <DeleteButton action={deleteAnnouncement.bind(null, announcement.id)} label={announcement.title} />
      </PageHeader>
      <div className="mt-6 rounded-lg border bg-background p-6">
        <AnnouncementForm
          departments={departments}
          values={{
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            date: utcIsoToZonedInputs(announcement.publish_at, timezone).date,
            department_id: announcement.department_id ?? "",
            status: announcement.status,
          }}
        />
      </div>
    </>
  )
}
