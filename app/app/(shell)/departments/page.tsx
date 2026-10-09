import { Building2 } from "lucide-react"
import Link from "next/link"

import { DepartmentMedia } from "@/components/student/department-media"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { type DepartmentCard, listPublishedDepartments } from "@/lib/campus/departments"
import { createClient } from "@/lib/supabase/server"

// Departments: the university's colleges and the programs they offer (Admin › Departments,
// Published only). Read-only.
export default async function DepartmentsPage() {
  await requireProfile()
  let departments: DepartmentCard[] | null = null
  try {
    departments = await listPublishedDepartments(await createClient())
  } catch {
    departments = null
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="Departments" description="Colleges of the university and the programs they offer." />

      {departments === null ? (
        <p role="alert" className="mt-6 text-sm text-destructive">Departments could not be loaded. Please try again.</p>
      ) : departments.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={Building2} title="No departments yet." description="Departments appear here once the university publishes them." />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <li key={d.id} className="flex">
              <Link
                href={`/app/departments/${d.id}`}
                className="group flex w-full flex-col overflow-hidden rounded-lg border bg-background transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <DepartmentMedia department={d} />
                <span className="flex flex-1 flex-col px-4 pt-8 pb-4">
                  <span className="font-semibold leading-snug group-hover:text-primary">{d.name}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{d.shortName}</span>
                  <span className="flex-1" />
                  <span className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    {d.programs.length} {d.programs.length === 1 ? "program" : "programs"} offered
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
