import { Plus, Users } from "lucide-react"
import Link from "next/link"

import { AdminDepartmentFilter } from "@/components/admin/admin-department-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getDepartments, resolveAdminDepartmentFilter } from "@/lib/departments"
import { createClient } from "@/lib/supabase/server"

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin()
  const [supabase, departments, { dept }] = await Promise.all([createClient(), getDepartments(), searchParams])
  // Students always belong to a department, so only "all" or one department applies.
  const resolved = resolveAdminDepartmentFilter(dept, departments)
  const department = resolved.kind === "department" ? resolved.department : null

  let query = supabase
    .from("profiles")
    .select("id, full_name, student_id, email, year_level, must_change_password, departments(code, name), programs(code, name)")
    .eq("role", "student")
    .order("created_at", { ascending: false })
  if (department) query = query.eq("department_id", department.id)
  const { data: students, error } = await query

  // Carries the current department into the form so it starts preselected.
  const addHref = department ? `/admin/users/new?dept=${encodeURIComponent(department.code)}` : "/admin/users/new"
  const noun = department ? `${department.code} students` : "students"

  return (
    <>
      <PageHeader
        title="Users"
        description="Student accounts are created by administrators. There is no public sign-up."
      >
        <Link href={addHref} className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          Add student
        </Link>
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <AdminDepartmentFilter
          value={department?.code ?? "all"}
          departments={departments}
          allLabel="All Students"
          showUniversity={false}
        />
        {students && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {students.length} {students.length === 1 ? noun.replace(/s$/, "") : noun}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-background">
        {error ? (
          <p role="alert" className="px-4 py-6 text-sm text-destructive">
            Student accounts could not be loaded. Please refresh this page.
          </p>
        ) : students && students.length > 0 ? (
          <div role="region" aria-label="Students table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Student</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Student ID</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Department</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Program</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Year</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/users/${s.id}`} className="font-medium hover:text-primary hover:underline">
                        {s.full_name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{s.student_id ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground" title={s.departments?.name}>
                      {s.departments?.code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" title={s.programs?.name}>
                      {s.programs?.code ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.year_level ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.must_change_password ? (
                        <StatusBadge status="draft" label="Awaiting first login" />
                      ) : (
                        <StatusBadge status="published" label="Active" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/admin/users/${s.id}`} className="font-medium text-primary hover:underline">
                        View / Edit<span className="sr-only"> {s.full_name ?? s.email}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-2">
            <EmptyState
              icon={Users}
              title={department ? `No ${department.code} students yet.` : "No student accounts yet."}
              description={
                department
                  ? `Add a student from the ${department.name}, or choose another department.`
                  : "Add a student to give them access to Campus Agent."
              }
            >
              <Link href={addHref} className={buttonVariants({ size: "lg" })}>
                <Plus aria-hidden="true" />
                Add student
              </Link>
            </EmptyState>
          </div>
        )}
      </div>
    </>
  )
}
