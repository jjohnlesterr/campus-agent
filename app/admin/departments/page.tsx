import { Building2 } from "lucide-react"

import { AddDepartmentButton, DepartmentGallery } from "@/components/admin/department-gallery"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Admin › Campus Content › Departments: departments and the programs they offer.
// Structured records only (no Knowledge Library, RAG or AI). Student pages come later.
export default async function AdminDepartmentsPage({ searchParams }: PageProps<"/admin/departments">) {
  await requireAdmin()
  const { new: openNew } = await searchParams
  const db = await createClient()
  const [{ data: departments, error }, { data: profiles }] = await Promise.all([
    db.from("departments")
      .select("id, code, name, description, facebook_url, logo_url, cover_image_url, cover_position_x, cover_position_y, is_published, sort_order, programs(id, code, name, sort_order)")
      .order("sort_order", { nullsFirst: false })
      .order("code"),
    // Accounts that point to a department or program: those cannot be deleted.
    db.from("profiles").select("department_id, intended_department_id, program_id, intended_program_id"),
  ])

  const usage = new Map<string, number>()
  const programDepartment = new Map((departments ?? []).flatMap((d) => d.programs.map((p) => [p.id, d.id] as const)))
  for (const profile of profiles ?? []) {
    const ids = new Set([
      profile.department_id, profile.intended_department_id,
      programDepartment.get(profile.program_id ?? ""), programDepartment.get(profile.intended_program_id ?? ""),
    ].filter((id): id is string => !!id))
    for (const id of ids) usage.set(id, (usage.get(id) ?? 0) + 1)
  }

  const list = (departments ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    shortName: d.code,
    description: d.description,
    facebookUrl: d.facebook_url,
    logoUrl: d.logo_url,
    coverUrl: d.cover_image_url,
    coverPosition: { x: Number(d.cover_position_x), y: Number(d.cover_position_y) },
    published: d.is_published,
    accounts: usage.get(d.id) ?? 0,
    programs: [...d.programs]
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.name.localeCompare(b.name))
      // The stored code exactly as saved; no code shows a blank field (never the name).
      .map((p) => ({ id: p.id, name: p.name, code: p.code ?? "" })),
  }))

  return (
    <>
      <PageHeader title="Departments" description="Colleges and the programs they offer. Press and hold a card, then drag to reorder.">
        <AddDepartmentButton defaultOpen={openNew === "1"} />
      </PageHeader>
      {error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">The departments could not be loaded. Refresh the page to try again.</p>
      ) : list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Building2} title="No departments yet" description="Add a department with its logo, cover image and the programs it offers." />
        </div>
      ) : (
        <DepartmentGallery departments={list} />
      )}
    </>
  )
}
