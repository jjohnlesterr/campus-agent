import { AnnouncementForm } from "@/components/admin/announcement-form"
import { CENTER_POSITION } from "@/components/admin/image-crop"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { sourceLabelPlaceholder } from "@/lib/announcements"
import { getAnnouncementScopes } from "@/lib/campus/announcement-scopes"
import { createClient } from "@/lib/supabase/server"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"

export default async function NewAnnouncementPage() {
  await requireAdmin()
  const [{ timezone, universityName }, scopes] = await Promise.all([getBranding(), createClient().then(getAnnouncementScopes)])
  const today = utcIsoToZonedInputs(new Date().toISOString(), timezone).date

  return (
    <>
      <PageHeader title="New announcement" description="Create a university announcement and link it to its official source." />
      <AnnouncementForm values={{ title: "", content: "", date: today, sourceLabel: "", sourceUrl: "", imageUrl: null, imagePosition: CENTER_POSITION, departmentId: null }} sourcePlaceholder={sourceLabelPlaceholder(universityName)} scopes={scopes} />
    </>
  )
}
