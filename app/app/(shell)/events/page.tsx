import { CalendarDays, Clock, MapPin } from "lucide-react"

import { DepartmentFilterSelect } from "@/components/shared/department-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate, formatTime, startOfTodayIso } from "@/lib/datetime"
import { describeFilter, filterValue, getDepartments, resolveDepartmentFilter } from "@/lib/departments"
import { createClient } from "@/lib/supabase/server"

export default async function EventsPage({ searchParams }: PageProps<"/app/events">) {
  const [profile, departments, { timezone }, { dept }] = await Promise.all([
    requireProfile(),
    getDepartments(),
    getBranding(),
    searchParams,
  ])
  const filter = resolveDepartmentFilter(dept, departments, profile.department_id)
  const myDepartment = departments.find((d) => d.id === profile.department_id)

  const supabase = await createClient()
  let query = supabase
    .from("events")
    .select("id, title, description, starts_at, all_day, venue, status, departments(code, name)")
    .neq("status", "draft")
    .gte("starts_at", startOfTodayIso(timezone))
    .order("starts_at")
  if (filter.kind === "mine") {
    query = query.or(`department_id.eq.${filter.department.id},department_id.is.null`)
  } else if (filter.kind === "department") {
    query = query.eq("department_id", filter.department.id)
  } else if (filter.kind === "university") {
    query = query.is("department_id", null)
  }
  const { data: events } = await query

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Events"
        description="Upcoming university activities from the official calendar."
      >
        <DepartmentFilterSelect
          value={filterValue(filter)}
          myDepartmentCode={myDepartment?.code ?? null}
          departments={departments}
        />
      </PageHeader>

      <p className="mt-5 text-sm text-muted-foreground">{describeFilter(filter, "events")}</p>

      {events && events.length > 0 ? (
        <ul className="mt-3 divide-y border-y">
          {events.map((ev) => (
            <li key={ev.id} className="flex gap-4 py-5 sm:gap-6">
              <div
                aria-hidden="true"
                className="flex w-14 shrink-0 flex-col items-center self-start rounded-lg border bg-background py-1.5"
              >
                <span className="text-[0.7rem] font-semibold tracking-wide text-primary uppercase">
                  {formatDate(ev.starts_at, timezone, { month: "short" })}
                </span>
                <span className="text-xl leading-tight font-semibold tabular-nums">
                  {formatDate(ev.starts_at, timezone, { day: "numeric" })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="font-semibold">{ev.title}</h2>
                  {ev.status === "cancelled" && (
                    <span className="rounded-md border border-destructive/30 px-1.5 text-xs font-medium text-destructive">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatDate(ev.starts_at, timezone)}
                    {ev.all_day ? " · All day" : ` · ${formatTime(ev.starts_at, timezone)}`}
                  </span>
                  {ev.venue && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {ev.venue}
                    </span>
                  )}
                </p>
                {ev.description && (
                  <p className="mt-2 max-w-prose text-sm leading-relaxed">{ev.description}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {ev.departments ? ev.departments.name : "University-wide"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <EmptyState
            icon={CalendarDays}
            title="No upcoming events found."
            description="Try another department or All departments from the menu above."
          />
        </div>
      )}
    </div>
  )
}
