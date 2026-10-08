import { UserPlus, Users } from "lucide-react"
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
import { userTypeLabel } from "@/lib/user-types"

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin()
  const [supabase, departments, { timezone }, { dept }] = await Promise.all([createClient(), getDepartments(), getBranding(), searchParams])
  // Filter by intended college (or, for older accounts, their enrolled college).
  const resolved = resolveAdminDepartmentFilter(dept, departments)
  const department = resolved.kind === "department" ? resolved.department : null

  let query = supabase
    .from("profiles")
    .select(
      `id, full_name, email, user_type, must_change_password, created_at,
       intended_department:departments!profiles_intended_department_id_fkey(code, name),
       intended_program:programs!profiles_intended_program_id_fkey(code, name),
       department:departments!profiles_department_id_fkey(code, name),
       program:programs!profiles_program_id_fkey(code, name)`
    )
    .eq("role", "student") // internal value for every non-admin (user) account
    .order("created_at", { ascending: false })
  if (department) {
    query = query.or(`intended_department_id.eq.${department.id},and(intended_department_id.is.null,department_id.eq.${department.id})`)
  }
  const { data: users, error } = await query

  // Carries the current college into the form so it starts preselected.
  const addHref = department ? `/admin/users/new?dept=${encodeURIComponent(department.code)}` : "/admin/users/new"
  const noun = department ? `${department.code} users` : "users"

  return (
    <>
      <PageHeader title="Users" description="Incoming freshmen and visitors create their own accounts through public sign-up.">
        <Link href={addHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <UserPlus aria-hidden="true" />
          Create account manually
        </Link>
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <AdminDepartmentFilter value={department?.code ?? "all"} departments={departments} allLabel="All Users" showUniversity={false} />
        {users && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {users.length} {users.length === 1 ? noun.replace(/s$/, "") : noun}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-background">
        {error ? (
          <p role="alert" className="px-4 py-6 text-sm text-destructive">
            Users could not be loaded. Please refresh this page.
          </p>
        ) : users && users.length > 0 ? (
          <div role="region" aria-label="Users table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">User Type</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Intended College / Program</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => {
                  const college = u.intended_department ?? u.department
                  const program = u.intended_department ? u.intended_program : u.program
                  return (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary hover:underline">
                          {u.full_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{userTypeLabel(u.user_type) ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground" title={[college?.name, program?.name].filter(Boolean).join(" · ") || undefined}>
                        {[college?.code, program?.code].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatDate(u.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.must_change_password ? (
                          <StatusBadge status="draft" label="Awaiting first login" />
                        ) : (
                          <StatusBadge status="published" label="Active" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                          View / Edit<span className="sr-only"> {u.full_name ?? u.email}</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-2">
            <EmptyState
              icon={Users}
              title={department ? `No ${department.code} users yet.` : "No registered users yet."}
              description={
                department
                  ? "Nobody has chosen this college yet. Choose another college or view all users."
                  : "Users appear here once incoming freshmen and visitors sign up."
              }
            />
          </div>
        )}
      </div>
    </>
  )
}
