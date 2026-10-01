import { CalendarDays, Plus } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate, formatTime } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

export default async function AdminEventsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ timezone }, { data: events }] = await Promise.all([
    getBranding(),
    supabase
      .from("events")
      .select("id, title, starts_at, all_day, venue, status, departments(code)")
      .order("starts_at", { ascending: false }),
  ])

  return (
    <>
      <PageHeader
        title="Events"
        description="Activities from the calendar of activities, university-wide or for a specific college."
      >
        <Link href="/admin/events/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          New event
        </Link>
      </PageHeader>

      <div className="mt-6 overflow-hidden rounded-lg border bg-background">
        {events && events.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Title</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Department</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatDate(ev.starts_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                    <span className="block text-xs text-muted-foreground">
                      {ev.all_day ? "All day" : formatTime(ev.starts_at, timezone)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{ev.title}</span>
                    {ev.venue && <span className="block text-xs text-muted-foreground">{ev.venue}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ev.departments?.code ?? "University-wide"}</td>
                  <td className="px-4 py-3"><StatusBadge status={ev.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/events/${ev.id}`} className="font-medium text-primary hover:underline">
                      Edit<span className="sr-only"> {ev.title}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2">
            <EmptyState icon={CalendarDays} title="No events yet." description="Create the first event from the calendar of activities." />
          </div>
        )}
      </div>
    </>
  )
}
