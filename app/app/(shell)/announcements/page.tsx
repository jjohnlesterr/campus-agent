import { Megaphone } from "lucide-react"

import { DepartmentFilterSelect } from "@/components/shared/department-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { describeFilter, filterValue, getDepartments, resolveDepartmentFilter } from "@/lib/departments"
import { createClient } from "@/lib/supabase/server"

export default async function AnnouncementsPage({ searchParams }: PageProps<"/app/announcements">) {
  const [profile, departments, { timezone }, { dept }] = await Promise.all([
    requireProfile(),
    getDepartments(),
    getBranding(),
    searchParams,
  ])
  const filter = resolveDepartmentFilter(dept, departments, profile.department_id)
  const myDepartment = departments.find((d) => d.id === profile.department_id)
  const now = new Date().toISOString()

  const supabase = await createClient()
  let query = supabase
    .from("announcements")
    .select("id, title, content, publish_at, departments(code, name)")
    .eq("status", "published")
    .lte("publish_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("publish_at", { ascending: false })
  if (filter.kind === "mine") {
    query = query.or(`department_id.eq.${filter.department.id},department_id.is.null`)
  } else if (filter.kind === "department") {
    query = query.eq("department_id", filter.department.id)
  } else if (filter.kind === "university") {
    query = query.is("department_id", null)
  }
  const { data: announcements } = await query

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader title="Announcements" description="Official notices from the university and its colleges.">
        <DepartmentFilterSelect
          value={filterValue(filter)}
          myDepartmentCode={myDepartment?.code ?? null}
          departments={departments}
        />
      </PageHeader>

      <p className="mt-5 text-sm text-muted-foreground">{describeFilter(filter, "announcements")}</p>

      {announcements && announcements.length > 0 ? (
        <ul className="mt-3 divide-y border-y">
          {announcements.map((a) => (
            <li key={a.id} className="py-5">
              <article>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={a.publish_at}>
                    {formatDate(a.publish_at, timezone, { month: "long", day: "numeric", year: "numeric" })}
                  </time>
                  {" · "}
                  {a.departments ? a.departments.name : "University-wide"}
                </p>
                <h2 className="mt-1 font-semibold">{a.title}</h2>
                <p className="mt-2 max-w-prose text-sm leading-relaxed whitespace-pre-line">{a.content}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <EmptyState
            icon={Megaphone}
            title="No active announcements."
            description="Try another department or All departments from the menu above."
          />
        </div>
      )}
    </div>
  )
}
