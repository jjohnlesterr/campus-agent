"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireProfile } from "@/lib/auth"
import { type FormState, optionalUuid, toFieldErrors } from "@/lib/forms"
import { createClient } from "@/lib/supabase/server"
import { USER_TYPE_VALUES } from "@/lib/user-types"

export type ProfileFormState = (NonNullable<FormState> & { saved?: boolean }) | undefined

const profileSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name.").max(120, "Use 120 characters or fewer."),
    user_type: z.enum(USER_TYPE_VALUES, "Choose Incoming Freshman or Visitor."),
    intended_department_id: optionalUuid,
    intended_program_id: optionalUuid,
  })
  .refine((v) => !v.intended_program_id || v.intended_department_id, { path: ["intended_program_id"], message: "Choose a college first." })

/**
 * Updates the signed-in user's own name, user type and intended college/program.
 * Runs with their session: column grants allow only these fields, and RLS only their row.
 * Role and email can never be changed here.
 */
export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const profile = await requireProfile()
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    user_type: formData.get("user_type") ?? "",
    intended_department_id: formData.get("intended_department_id") ?? "",
    intended_program_id: formData.get("intended_program_id") ?? "",
  })
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }

  const supabase = await createClient()
  if (parsed.data.intended_program_id) {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("id", parsed.data.intended_program_id)
      .eq("department_id", parsed.data.intended_department_id ?? "")
      .maybeSingle()
    if (!program) return { fieldErrors: { intended_program_id: "Choose a program from the selected college." } }
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id)
  if (error) {
    console.error("updateProfile failed", error.code)
    return { error: "Your profile could not be saved. Please try again." }
  }

  revalidatePath("/app", "layout")
  return { saved: true }
}
