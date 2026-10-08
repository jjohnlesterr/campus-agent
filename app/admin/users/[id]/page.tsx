import { notFound } from "next/navigation"
import { z } from "zod"

import { AccountsNotConfigured } from "@/components/admin/accounts-not-configured"
import { EditUserForm, ResetPasswordForm } from "@/components/admin/user-form"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { getDepartments, getPrograms } from "@/lib/departments"
import { hasServiceRoleKey } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { userTypeLabel } from "@/lib/user-types"

export default async function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  const [{ data: user }, departments, programs, { timezone }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, user_type, intended_department_id, intended_program_id, department_id, program_id, student_id, year_level, must_change_password, created_at"
      )
      .eq("id", id)
      .eq("role", "student") // internal value for every non-admin (user) account
      .maybeSingle(),
    getDepartments(),
    getPrograms(),
    getBranding(),
  ])
  if (!user) notFound()
  const configured = hasServiceRoleKey()

  return (
    <>
      <PageHeader title={user.full_name ?? user.email ?? "User"} description={userTypeLabel(user.user_type) ?? "User account"}>
        {user.must_change_password ? (
          <StatusBadge status="draft" label="Awaiting first login" />
        ) : (
          <StatusBadge status="published" label="Active" />
        )}
      </PageHeader>
      {!configured && <AccountsNotConfigured />}

      <section aria-labelledby="details-heading" className="mt-6 max-w-2xl rounded-lg border bg-background p-6">
        <h2 id="details-heading" className="font-semibold">
          Details
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Joined {formatDate(user.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
        </p>
        <div className="mt-5">
          <EditUserForm
            departments={departments}
            programs={programs}
            disabled={!configured}
            user={{
              id: user.id,
              full_name: user.full_name ?? "",
              email: user.email ?? "",
              user_type: user.user_type ?? "",
              // Older accounts only have their enrolled college/program; start from those.
              intended_department_id: user.intended_department_id ?? user.department_id ?? "",
              intended_program_id: user.intended_department_id ? (user.intended_program_id ?? "") : (user.program_id ?? ""),
              student_id: user.student_id ?? "",
              year_level: user.year_level ? String(user.year_level) : "",
            }}
          />
        </div>
      </section>

      <section aria-labelledby="password-heading" className="mt-6 max-w-2xl rounded-lg border bg-background p-6">
        <h2 id="password-heading" className="font-semibold">
          Temporary password
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          For a user who can&apos;t sign in. Passwords are kept only by Supabase Auth — Campus Agent never stores or
          shows the current one.
        </p>
        <div className="mt-5">
          <ResetPasswordForm userId={user.id} disabled={!configured} />
        </div>
      </section>
    </>
  )
}
