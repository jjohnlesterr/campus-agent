import { EventForm } from "@/components/admin/event-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getDepartments, resolveAdminDepartmentFilter } from "@/lib/departments"

export default async function NewEventPage({ searchParams }: PageProps<"/admin/events/new">) {
  await requireAdmin()
  const [departments, { dept }] = await Promise.all([getDepartments(), searchParams])
  // Coming from a filtered list (?dept=CECT) preselects that department.
  const filter = resolveAdminDepartmentFilter(dept, departments)
  const departmentId = filter.kind === "department" ? filter.department.id : ""

  return (
    <>
      <PageHeader title="New event" />
      <div className="mt-6 rounded-lg border bg-background p-6">
        <EventForm
          departments={departments}
          values={{ title: "", date: "", time: "", venue: "", department_id: departmentId, description: "", status: "published" }}
        />
      </div>
    </>
  )
}
