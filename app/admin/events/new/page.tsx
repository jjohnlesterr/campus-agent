import { EventForm } from "@/components/admin/event-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getDepartments } from "@/lib/departments"

export default async function NewEventPage() {
  await requireAdmin()
  const departments = await getDepartments()

  return (
    <>
      <PageHeader title="New event" />
      <div className="mt-6 rounded-lg border bg-background p-6">
        <EventForm
          departments={departments}
          values={{ title: "", date: "", time: "", venue: "", department_id: "", description: "", status: "published" }}
        />
      </div>
    </>
  )
}
