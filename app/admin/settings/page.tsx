import { GraduationCap } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function AdminSettingsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ data: settings }, { data: departments }] = await Promise.all([
    supabase.from("system_settings").select("*").maybeSingle(),
    supabase
      .from("departments")
      .select("code, name, programs(id, code, name)")
      .order("code")
      .order("name", { referencedTable: "programs" }),
  ])

  const programCount = departments?.reduce((n, d) => n + d.programs.length, 0) ?? 0

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

      <section aria-labelledby="branding-heading" className="mt-6 overflow-hidden rounded-lg border bg-background">
        <h2 id="branding-heading" className="border-b px-5 py-4 font-semibold">
          Branding
        </h2>
        <dl className="divide-y">
          {branding.map((b) => (
            <div key={b.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4 px-5 py-3 text-sm">
              <dt className="text-muted-foreground">{b.label}</dt>
              <dd className="min-w-0 break-words">{b.value ?? <span className="text-muted-foreground">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="colleges-heading" className="mt-6 overflow-hidden rounded-lg border bg-background">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b px-5 py-4">
          <h2 id="colleges-heading" className="font-semibold">
            Colleges and programs
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">{departments?.length ?? 0} colleges</p>
        </div>
        {departments && departments.length > 0 ? (
          <div role="region" aria-label="Colleges and programs table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-5 py-2.5 font-medium">Code</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">College</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Programs <span className="font-normal">({programCount})</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {departments.map((d) => (
                  <tr key={d.code} className="align-top">
                    <td className="px-5 py-3 font-medium tabular-nums">{d.code}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{d.name}</td>
                    <td className="px-5 py-3">
                      {d.programs.length > 0 ? (
                        <ul className="flex flex-col gap-1.5">
                          {d.programs.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-baseline gap-x-2">
                              <span>{p.name}</span>
                              {p.code !== p.name && (
                                <span className="rounded border bg-muted/50 px-1.5 text-xs text-muted-foreground">{p.code}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground italic">Programs not yet added</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={GraduationCap} title="No colleges added yet." description="Colleges and programs will appear here once the university's academic structure is configured." />
        )}
      </section>
    </>
  )
}
