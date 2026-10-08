"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { type FormState, optionalId, toFieldErrors } from "@/lib/forms"
import { createClient } from "@/lib/supabase/server"

const officeSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2, "Enter the office name.").max(200),
  head_name: z.string().trim().max(200),
  office_hours: z.string().trim().max(200),
  location: z.string().trim().max(200),
})

function revalidate() {
  revalidatePath("/admin/offices")
  revalidatePath("/admin/campus-map")
  revalidatePath("/app/offices")
  revalidatePath("/app/map")
}

export async function saveOffice(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = officeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { id, location, ...input } = parsed.data

  const supabase = await createClient()

  // The office's location is a campus location (shared with the campus map).
  // Reuse one with the same name, otherwise create it.
  let campusLocationId: string | null = null
  if (location) {
    const { data: existing } = await supabase
      .from("campus_locations")
      .select("id")
      .eq("name", location)
      .limit(1)
      .maybeSingle()
    if (existing) {
      campusLocationId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from("campus_locations")
        .insert({ name: location })
        .select("id")
        .single()
      if (error) return { error: "We couldn't save the location. Please try again." }
      campusLocationId = created.id
    }
  }

  const row = {
    name: input.name,
    head_name: input.head_name || null,
    office_hours: input.office_hours || null,
    campus_location_id: campusLocationId,
  }
  const { error } = id
    ? await supabase.from("offices").update(row).eq("id", id)
    : await supabase.from("offices").insert(row)
  if (error) {
    if (error.code === "23505") return { fieldErrors: { name: "An office with this name already exists." } }
    return { error: "We couldn't save this office. Please try again." }
  }

  revalidate()
  redirect("/admin/offices")
}

export async function deleteOffice(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from("offices").delete().eq("id", id)
  revalidate()
  redirect("/admin/offices")
}
