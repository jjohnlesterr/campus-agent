import { notFound } from "next/navigation"
import { z } from "zod"

import { AccountsNotConfigured } from "@/components/admin/accounts-not-configured"
import { EditStudentForm, ResetPasswordForm } from "@/components/admin/student-form"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { getDepartments, getPrograms } from "@/lib/departments"
import { hasServiceRoleKey } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export default async function EditStudentPage({ params }: PageProps<"/admin/users/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  const [{ data: student }, departments, programs, { timezone }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, student_id, email, department_id, program_id, year_level, must_change_password, created_at")
      .eq("id", id)
      .eq("role", "student")
      .maybeSingle(),
    getDepartments(),
    getPrograms(),
    getBranding(),
  ])
  if (!student) notFound()
  const configured = hasServiceRoleKey()

  return (
    <>
      <PageHeader title={student.full_name ?? student.email ?? "Student"} description="Student account">
        {student.must_change_password ? (
          <StatusBadge status="draft" label="Awaiting first login" />
        ) : (
          <StatusBadge status="published" label="Active" />
        )}
      </PageHeader>
      {!configured && <AccountsNotConfigured />}

      <section aria-labelledby="details-heading" className="mt-6 rounded-lg border bg-background p-6">
        <h2 id="details-heading" className="font-semibold">
          Details
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Account created {formatDate(student.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
        </p>
        <div className="mt-5">
          <EditStudentForm
            departments={departments}
            programs={programs}
            disabled={!configured}
            student={{
              id: student.id,
              full_name: student.full_name ?? "",
              student_id: student.student_id ?? "",
              email: student.email ?? "",
              department_id: student.department_id ?? "",
              program_id: student.program_id ?? "",
              year_level: student.year_level ? String(student.year_level) : "",
            }}
          />
        </div>
      </section>

      <section aria-labelledby="password-heading" className="mt-6 rounded-lg border bg-background p-6">
        <h2 id="password-heading" className="font-semibold">
          Temporary password
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          For a student who can&apos;t sign in. Passwords are kept only by Supabase Auth — Campus Agent never stores or
          shows the current one.
        </p>
        <div className="mt-5">
          <ResetPasswordForm studentId={student.id} disabled={!configured} />
        </div>
      </section>
    </>
  )
}
