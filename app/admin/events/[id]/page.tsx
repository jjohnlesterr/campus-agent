import { notFound } from "next/navigation"

import { deleteEvent } from "@/app/admin/events/actions"
import { DeleteButton } from "@/components/admin/delete-button"
import { EventForm } from "@/components/admin/event-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { utcIsoToZonedInputs } from "@/lib/datetime"
import { getDepartments } from "@/lib/departments"
import { createClient } from "@/lib/supabase/server"

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const [{ data: event }, departments, { timezone }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    getDepartments(),
    getBranding(),
  ])
  if (!event) notFound()

  const { date, time } = utcIsoToZonedInputs(event.starts_at, timezone)

  return (
    <>
      <PageHeader title="Edit event">
        <DeleteButton action={deleteEvent.bind(null, event.id)} label={event.title} />
      </PageHeader>
      <div className="mt-6 rounded-lg border bg-background p-6">
        <EventForm
          departments={departments}
          values={{
            id: event.id,
            title: event.title,
            date,
            time: event.all_day ? "" : time,
            venue: event.venue ?? "",
            department_id: event.department_id ?? "",
            description: event.description ?? "",
            status: event.status,
          }}
        />
      </div>
    </>
  )
}
