import { AnnouncementForm } from "@/components/admin/announcement-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"

export default async function NewAnnouncementPage() {
  await requireAdmin()
  const { timezone } = await getBranding()
  const today = utcIsoToZonedInputs(new Date().toISOString(), timezone).date

  return (
    <>
      <PageHeader title="New announcement" description="A university-wide notice. Save it as a draft to review it first, or publish it now." />
      <div className="mt-6 max-w-2xl rounded-lg border bg-background p-6">
        <AnnouncementForm values={{ title: "", content: "", date: today, sourceLabel: "", sourceUrl: "" }} />
      </div>
    </>
  )
}
