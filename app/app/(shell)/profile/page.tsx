import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Read-only: student records are provisioned by the university administrator.
export default async function ProfilePage() {
  const profile = await requireProfile()
  const supabase = await createClient()
  const [{ data: department }, { data: program }] = await Promise.all([
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).maybeSingle()
      : Promise.resolve({ data: null }),
    profile.program_id
      ? supabase.from("programs").select("name").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const details = [
    { label: "Full name", value: profile.full_name },
    { label: "Student ID", value: profile.student_id },
    { label: "School email", value: profile.email },
    { label: "College", value: department?.name },
    { label: "Program", value: program?.name },
    { label: "Year level", value: profile.year_level ? `Year ${profile.year_level}` : null },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Your profile"
        description="Your college and program help Campus Agent show the most relevant information first."
      />
      <dl className="mt-8 grid max-w-2xl gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        {details.map((d) => (
          <div key={d.label} className="bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">{d.label}</dt>
            <dd className="mt-1 text-sm font-medium break-words">{d.value ?? "Not set"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Something incorrect? Your record is managed by the university. Contact your administrator to update it.
      </p>
    </div>
  )
}
