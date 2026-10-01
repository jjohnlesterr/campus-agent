import { AnnouncementForm } from "@/components/admin/announcement-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"
import { getDepartments } from "@/lib/departments"

export default async function NewAnnouncementPage() {
  await requireAdmin()
  const [departments, { timezone }] = await Promise.all([getDepartments(), getBranding()])
  const today = utcIsoToZonedInputs(new Date().toISOString(), timezone).date

  return (
    <>
      <PageHeader title="New announcement" />
      <div className="mt-6 rounded-lg border bg-background p-6">
        <AnnouncementForm
          departments={departments}
          values={{ title: "", content: "", date: today, department_id: "", status: "published" }}
        />
      </div>
    </>
  )
}
