import { AccountsNotConfigured } from "@/components/admin/accounts-not-configured"
import { CreateStudentForm } from "@/components/admin/student-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getDepartments, getPrograms } from "@/lib/departments"
import { hasServiceRoleKey } from "@/lib/supabase/admin"

export default async function NewStudentPage({ searchParams }: PageProps<"/admin/users/new">) {
  await requireAdmin()
  const [departments, programs, { dept }] = await Promise.all([getDepartments(), getPrograms(), searchParams])
  // Coming from a filtered Users view (?dept=CECT) preselects that department.
  const preselected = departments.find((d) => d.code === (Array.isArray(dept) ? dept[0] : dept))
  const backHref = preselected ? `/admin/users?dept=${encodeURIComponent(preselected.code)}` : "/admin/users"
  const configured = hasServiceRoleKey()

  return (
    <>
      <PageHeader
        title="Add student"
        description="Creates a sign-in account with a temporary password. The student changes it on first login."
      />
      {!configured && <AccountsNotConfigured />}
      <div className="mt-6 rounded-lg border bg-background p-6">
        <CreateStudentForm
          departments={departments}
          programs={programs}
          defaultDepartmentId={preselected?.id}
          backHref={backHref}
          disabled={!configured}
        />
      </div>
    </>
  )
}
