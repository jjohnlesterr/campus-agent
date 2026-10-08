import { notFound } from "next/navigation"

import { deleteOffice } from "@/app/admin/offices/actions"
import { getLocationNames } from "@/app/admin/offices/location-names"
import { DeleteButton } from "@/components/admin/delete-button"
import { OfficeForm } from "@/components/admin/office-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function EditOfficePage({ params }: PageProps<"/admin/offices/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const [{ data: office }, locationNames] = await Promise.all([
    supabase
      .from("offices")
      .select("id, name, head_name, office_hours, campus_locations(name)")
      .eq("id", id)
      .maybeSingle(),
    getLocationNames(),
  ])
  if (!office) notFound()

  return (
    <>
      <PageHeader title="Edit office">
        <DeleteButton action={deleteOffice.bind(null, office.id)} label={office.name} />
      </PageHeader>
      <div className="mt-6 max-w-2xl rounded-lg border bg-background p-6">
        <OfficeForm
          locationNames={locationNames}
          values={{
            id: office.id,
            name: office.name,
            head_name: office.head_name ?? "",
            office_hours: office.office_hours ?? "",
            location: office.campus_locations?.name ?? "",
          }}
        />
      </div>
    </>
  )
}
