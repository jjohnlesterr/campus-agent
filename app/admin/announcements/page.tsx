import { Megaphone, Plus } from "lucide-react"
import Link from "next/link"

import { AdminDepartmentFilter } from "@/components/admin/admin-department-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { getDepartments, resolveAdminDepartmentFilter } from "@/lib/departments"
import { createClient } from "@/lib/supabase/server"

export default async function AdminAnnouncementsPage({ searchParams }: PageProps<"/admin/announcements">) {
  await requireAdmin()
  const [supabase, departments, { dept }] = await Promise.all([createClient(), getDepartments(), searchParams])
  const filter = resolveAdminDepartmentFilter(dept, departments)

  let query = supabase
    .from("announcements")
    .select("id, title, publish_at, status, departments(code)")
    .order("publish_at", { ascending: false })
  if (filter.kind === "university") query = query.is("department_id", null)
  if (filter.kind === "department") query = query.eq("department_id", filter.department.id)

  const [{ timezone }, { data: announcements }] = await Promise.all([getBranding(), query])
  const filterValue = filter.kind === "department" ? filter.department.code : filter.kind

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Official notices for all students or for a specific college."
      >
        <Link href={filter.kind === "department" ? `/admin/announcements/new?dept=${filter.department.code}` : "/admin/announcements/new"} className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          New announcement
        </Link>
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <AdminDepartmentFilter value={filterValue} departments={departments} />
        {announcements && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {announcements.length} {announcements.length === 1 ? "announcement" : "announcements"}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-background">
        {announcements && announcements.length > 0 ? (
          <div role="region" aria-label="Announcements table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
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
                {announcements.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatDate(a.publish_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/announcements/${a.id}`} className="font-medium hover:text-primary hover:underline">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.departments?.code ?? "University-wide"}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/announcements/${a.id}`} className="font-medium text-primary hover:underline">
                        Edit<span className="sr-only"> {a.title}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-2">
            {filter.kind === "all" ? (
              <EmptyState icon={Megaphone} title="No announcements yet." description="Create the first announcement for students." />
            ) : (
              <EmptyState
                icon={Megaphone}
                title={filter.kind === "university" ? "No university-wide announcements." : `No ${filter.department.code} announcements.`}
                description="Choose another department or create an announcement for this one."
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}
