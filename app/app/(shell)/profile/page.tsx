import { PageHeader } from "@/components/shared/page-header"
import { ProfileForm } from "@/components/student/profile-form"
import { requireProfile } from "@/lib/auth"
import { getDepartments, getPrograms } from "@/lib/departments"

export default async function ProfilePage() {
  const [profile, departments, programs] = await Promise.all([requireProfile(), getDepartments(), getPrograms()])

  // Older accounts created by an administrator may still carry a student record.
  const legacy = [
    { label: "Student ID", value: profile.student_id },
    { label: "Year level", value: profile.year_level ? `Year ${profile.year_level}` : null },
  ].filter((d) => d.value)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Your profile"
        description="Your intended college and program help Campus Agent show the most relevant information first. You can still browse everything."
      />

      <dl className="mt-8 grid max-w-xl gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        {[{ label: "Email", value: profile.email }, ...legacy].map((d) => (
          <div key={d.label} className="bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">{d.label}</dt>
            <dd className="mt-1 text-sm font-medium break-words">{d.value ?? "Not set"}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <ProfileForm
          departments={departments}
          programs={programs}
          values={{
            full_name: profile.full_name ?? "",
            user_type: profile.user_type ?? "",
            intended_department_id: profile.intended_department_id ?? "",
            intended_program_id: profile.intended_program_id ?? "",
          }}
        />
      </div>
    </div>
  )
}
