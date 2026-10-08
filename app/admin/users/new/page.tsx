import { AccountsNotConfigured } from "@/components/admin/accounts-not-configured"
import { CreateUserForm } from "@/components/admin/user-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { getDepartments, getPrograms } from "@/lib/departments"
import { hasServiceRoleKey } from "@/lib/supabase/admin"

// Secondary path: freshmen and visitors normally create their own accounts.
export default async function NewUserPage({ searchParams }: PageProps<"/admin/users/new">) {
  await requireAdmin()
  const [departments, programs, { dept }] = await Promise.all([getDepartments(), getPrograms(), searchParams])
  // Coming from a filtered Users view (?dept=CECT) preselects that college.
  const preselected = departments.find((d) => d.code === (Array.isArray(dept) ? dept[0] : dept))
  const backHref = preselected ? `/admin/users?dept=${encodeURIComponent(preselected.code)}` : "/admin/users"
  const configured = hasServiceRoleKey()

  return (
    <>
      <PageHeader
        title="Create account manually"
        description="Users normally sign up on their own. Use this only when someone needs an account set up for them: it gets a temporary password that must be changed on first login."
      />
      {!configured && <AccountsNotConfigured />}
      <div className="mt-6 max-w-2xl rounded-lg border bg-background p-6">
        <CreateUserForm
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
