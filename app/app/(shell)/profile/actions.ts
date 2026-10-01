"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { requireProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type ProfileFormState =
  | { error?: string; fieldErrors?: Partial<Record<keyof ProfileInput, string>> }
  | undefined

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  student_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,20}$/, "Use 3–20 letters, numbers or dashes."),
  department_id: z.uuid("Choose your department."),
  // Optional only for colleges that have no programs listed (checked below).
  program_id: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.uuid("Choose your program.").nullable()),
  year_level: z.coerce.number().int().min(1, "Choose your year level.").max(6),
})

type ProfileInput = z.infer<typeof profileSchema>

// Students can only change these fields. Role and email are not part of the
// form, and the database rejects writes to them for student accounts.
export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const profile = await requireProfile()

  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ProfileInput, string>> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ProfileInput
      fieldErrors[key] ??= issue.message
    }
    return { fieldErrors }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: departmentPrograms } = await supabase
    .from("programs")
    .select("id")
    .eq("department_id", input.department_id)
  const programIds = (departmentPrograms ?? []).map((p) => p.id)
  if (programIds.length > 0 && !(input.program_id && programIds.includes(input.program_id))) {
    return { fieldErrors: { program_id: "Choose a program from your department." } }
  }
  if (programIds.length === 0) input.program_id = null

  const { error } = await supabase
    .from("profiles")
    .update({ ...input, onboarded_at: profile.onboarded_at ?? new Date().toISOString() })
    .eq("id", profile.id)

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { student_id: "This student ID is already registered." } }
    }
    return { error: "We couldn't save your profile. Please try again." }
  }

  redirect("/app")
}
