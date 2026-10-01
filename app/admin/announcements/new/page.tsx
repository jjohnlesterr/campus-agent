import { AnnouncementForm } from "@/components/admin/announcement-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"
import { getDepartments, resolveAdminDepartmentFilter } from "@/lib/departments"

export default async function NewAnnouncementPage({ searchParams }: PageProps<"/admin/announcements/new">) {
  await requireAdmin()
  const [departments, { timezone }, { dept }] = await Promise.all([getDepartments(), getBranding(), searchParams])
  // Coming from a filtered list (?dept=CECT) preselects that department.
  const filter = resolveAdminDepartmentFilter(dept, departments)
  const departmentId = filter.kind === "department" ? filter.department.id : ""
  const today = utcIsoToZonedInputs(new Date().toISOString(), timezone).date

  return (
    <>
      <PageHeader title="New announcement" />
      <div className="mt-6 rounded-lg border bg-background p-6">
        <AnnouncementForm
          departments={departments}
          values={{ title: "", content: "", date: today, department_id: departmentId, status: "published" }}
        />
      </div>
    </>
  )
}
