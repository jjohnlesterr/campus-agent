import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function AdminSettingsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ data: settings }, { data: departments }] = await Promise.all([
    supabase.from("system_settings").select("*").maybeSingle(),
    supabase.from("departments").select("code, name, programs(code, name)").order("name"),
  ])

  const branding = [
    { label: "Assistant name", value: settings?.assistant_name },
    { label: "University name", value: settings?.university_name },
    { label: "Short name", value: settings?.university_short_name },
    { label: "Timezone", value: settings?.timezone },
  ]

  return (
    <>
      <PageHeader
        title="Settings"
        description="Branding and academic structure. Editing these will be available in a later phase."
      />

      <section aria-labelledby="branding-heading" className="mt-6 rounded-lg border bg-background">
        <h2 id="branding-heading" className="border-b px-5 py-4 font-semibold">
          Branding
        </h2>
        <dl className="divide-y">
          {branding.map((b) => (
            <div key={b.label} className="grid grid-cols-[12rem_1fr] gap-4 px-5 py-3 text-sm">
              <dt className="text-muted-foreground">{b.label}</dt>
              <dd>{b.value ?? <span className="text-muted-foreground">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="colleges-heading" className="mt-6 rounded-lg border bg-background">
        <div className="flex items-baseline justify-between gap-4 border-b px-5 py-4">
          <h2 id="colleges-heading" className="font-semibold">
            Colleges and programs
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">{departments?.length ?? 0} colleges</p>
        </div>
        {departments && departments.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-5 py-2.5 font-medium">Code</th>
                <th scope="col" className="px-5 py-2.5 font-medium">College</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Programs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {departments.map((d) => (
                <tr key={d.code}>
                  <td className="px-5 py-3 font-medium tabular-nums">{d.code}</td>
                  <td className="px-5 py-3">{d.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {d.programs.map((p) => p.code).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No colleges added yet.</p>
        )}
      </section>
    </>
  )
}
