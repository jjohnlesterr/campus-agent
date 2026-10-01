import { getLocationNames } from "@/app/admin/offices/location-names"
import { OfficeForm } from "@/components/admin/office-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"

export default async function NewOfficePage() {
  await requireAdmin()
  const locationNames = await getLocationNames()

  return (
    <>
      <PageHeader title="New office" />
      <div className="mt-6 rounded-lg border bg-background p-6">
        <OfficeForm
          locationNames={locationNames}
          values={{ name: "", head_name: "", office_hours: "", location: "" }}
        />
      </div>
    </>
  )
}
