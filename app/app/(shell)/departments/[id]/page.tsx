import { ExternalLink, GraduationCap } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { DepartmentCover } from "@/components/student/department-cover"
import { DepartmentLogo } from "@/components/student/department-logo"
import { buttonVariants } from "@/components/ui/button"
import { requireProfile } from "@/lib/auth"
import { getPublishedDepartment, programCode } from "@/lib/campus/departments"
import { createClient } from "@/lib/supabase/server"

// One department: a fixed-height cover banner (the admin's crop position), then the logo,
// name, description and programs in one content column. The logo sits mostly below the
// banner, overlapping its bottom edge only slightly, so it never covers the cover's content.
export default async function DepartmentPage({ params }: PageProps<"/app/departments/[id]">) {
  await requireProfile()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const department = await getPublishedDepartment(await createClient(), id)
  if (!department) notFound()

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/app/departments" className="font-medium text-primary hover:underline">Departments</Link>
      </nav>

      {/* Banner: fixed height; only the image is clipped (the logo is outside it). Opens the full image. */}
      <DepartmentCover src={department.coverUrl} position={department.coverPosition} name={department.name} />

      {/* One content column for the logo, title and programs. */}
      <div className="sm:px-6">
        <DepartmentLogo src={department.logoUrl} name={department.name} shortName={department.shortName} />

        <header className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight">{department.name}</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{department.shortName}</p>
          {department.facebookUrl && (
            // The official page, opened in a new tab; the raw URL is never shown.
            <a href={department.facebookUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
              Visit Facebook page
              <ExternalLink aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {department.description && <p className="mt-4 max-w-prose leading-relaxed whitespace-pre-line text-foreground/90">{department.description}</p>}
        </header>

        <section aria-labelledby="programs-heading" className="mt-8">
          <h2 id="programs-heading" className="font-semibold">Programs offered</h2>
          {department.programs.length > 0 ? (
            <ul className="mt-3 divide-y overflow-hidden rounded-lg border bg-background">
              {department.programs.map((p) => {
                const code = programCode(p)
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <GraduationCap className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm">{p.name}</span>
                    {code && <span className="shrink-0 rounded border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">{code}</span>}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No programs are listed for this department yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
