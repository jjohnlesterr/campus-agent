"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { appUrl } from "@/lib/app-url"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { buildAccountEmail } from "@/lib/email/account-email"
import { type SendFailure, sendEmail } from "@/lib/email/send"
import { type FormState, optionalUuid, toFieldErrors } from "@/lib/forms"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { USER_TYPE_VALUES } from "@/lib/user-types"

// Admin → Users. Freshmen and visitors normally create their own accounts through
// public sign-up; creating one here is the secondary, manual path (temporary password,
// changed on first login). Only non-admin accounts (internal role "student") are
// listed or edited — never an admin, and the role itself is never changed here.

const NOT_CONFIGURED = "User accounts can't be managed yet: the server is missing SUPABASE_SERVICE_ROLE_KEY."
const GENERIC_ERROR = "The account could not be saved. Please try again."
const DUPLICATE_EMAIL = "An account with this email already exists."

const password = z.string().trim().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer.")

/** "" → null for optional text fields. */
const blankToNull = <T extends string>(schema: z.ZodType<T, string>) =>
  z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(schema.nullable())

const profileFields = z.object({
  full_name: z.string().trim().min(2, "Enter the user's full name.").max(120),
  user_type: blankToNull(z.enum(USER_TYPE_VALUES, "Choose a user type.")),
  intended_department_id: optionalUuid,
  intended_program_id: optionalUuid,
  // Legacy student details: optional, kept for accounts created before public sign-up.
  student_id: blankToNull(z.string().regex(/^[A-Za-z0-9-]{3,30}$/, "Use 3–30 letters, numbers or dashes.")),
  year_level: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1, "Choose a year level.").max(6, "Choose a year level.").nullable()),
})

const createSchema = profileFields.extend({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password,
})

const updateSchema = profileFields.extend({ id: z.uuid() })

/** Form values with optional fields defaulted — disabled or omitted selects aren't submitted. */
function formInput(formData: FormData) {
  return { user_type: "", intended_department_id: "", intended_program_id: "", student_id: "", year_level: "", ...Object.fromEntries(formData) }
}

/** Whether the sign-in details email went out. Reported to the admin, never assumed. */
export type EmailStatus = "sent" | SendFailure

export type CreateUserState =
  | (NonNullable<FormState> & { created?: undefined })
  | { created: { fullName: string; email: string; temporaryPassword: string; emailStatus: EmailStatus } }
  | undefined

export type ResetPasswordState =
  | (NonNullable<FormState> & { temporaryPassword?: undefined })
  | { temporaryPassword: string; email: string; emailStatus: EmailStatus }
  | undefined

/** Emails sign-in details. The password lives only in this request's memory and the message itself. */
async function emailSignInDetails(to: { fullName: string; email: string }, temporaryPassword: string, reason: "created" | "reset"): Promise<EmailStatus> {
  try {
    const [{ assistantName }, base] = await Promise.all([getBranding(), appUrl()])
    // Mail clients can only load the logo from a public https address (not localhost).
    const logoUrl = base.protocol === "https:" ? new URL("/assets/logo.png", base).toString() : undefined
    const loginUrl = new URL("/login", base).toString()
    const message = buildAccountEmail({ ...to, temporaryPassword, loginUrl, assistantName, logoUrl, reason })
    const result = await sendEmail({ to: to.email, ...message })
    return result.ok ? "sent" : result.reason
  } catch {
    console.error("emailSignInDetails: could not prepare the email")
    return "failed"
  }
}

function revalidate(id?: string) {
  revalidatePath("/admin/users")
  revalidatePath("/admin")
  if (id) revalidatePath(`/admin/users/${id}`)
}

/** Program must belong to the intended college; a student ID, if given, must be free. Uses the admin's own session (RLS). */
async function validateProfile(input: z.infer<typeof profileFields>, exceptId?: string): Promise<Record<string, string> | null> {
  const supabase = await createClient()
  if (input.intended_program_id) {
    if (!input.intended_department_id) return { intended_program_id: "Choose a college first." }
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("id", input.intended_program_id)
      .eq("department_id", input.intended_department_id)
      .maybeSingle()
    if (!program) return { intended_program_id: "Choose a program from the selected college." }
  }
  if (input.student_id) {
    let taken = supabase.from("profiles").select("id").eq("student_id", input.student_id)
    if (exceptId) taken = taken.neq("id", exceptId)
    const { data } = await taken.maybeSingle()
    if (data) return { student_id: "Another account already uses this student ID." }
  }
  return null
}

/** Only user accounts (internal role "student") can be edited from Admin → Users — never an admin. */
async function isUserAccount(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle()
  return data?.role === "student"
}

/**
 * Manually creates a user account. The password is handed to Supabase Auth only —
 * it is never written to profiles or any custom table. It is returned once in
 * this response so the admin can share it; the user must change it on first login.
 */
export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireAdmin()
  const parsed = createSchema.safeParse(formInput(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { password, email, ...details } = parsed.data

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  const fieldErrors = await validateProfile(details)
  if (fieldErrors) return { fieldErrors }
  // Profiles mirror every Auth account's email, so an existing account is caught before Auth is touched.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (existing) return { fieldErrors: { email: DUPLICATE_EMAIL } }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // created by an admin; no confirmation email
    user_metadata: { full_name: details.full_name },
  })
  if (authError || !created.user) {
    if (authError?.code === "email_exists") return { fieldErrors: { email: DUPLICATE_EMAIL } }
    if (authError?.code === "weak_password") return { fieldErrors: { password: "This password is too weak. Use a longer one with letters and numbers." } }
    console.error("createUser: auth user creation failed", authError?.code)
    return { error: GENERIC_ERROR }
  }

  // The signup trigger already created the profile (role is always the user role, email copied from Auth).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ ...details, must_change_password: true })
    .eq("id", created.user.id)
  if (profileError) {
    // Don't leave a half-provisioned login behind.
    await admin.auth.admin.deleteUser(created.user.id)
    if (profileError.code === "23505") return { fieldErrors: { student_id: "Another account already uses this student ID." } }
    console.error("createUser: profile update failed", profileError.code)
    return { error: GENERIC_ERROR }
  }

  revalidate()
  // The account is complete at this point; a failed email never undoes it.
  const emailStatus = await emailSignInDetails({ fullName: details.full_name, email }, password, "created")
  return { created: { fullName: details.full_name, email, temporaryPassword: password, emailStatus } }
}

/** Edits a user's profile details. Email (the sign-in identity) and role are not changed here. */
export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = updateSchema.safeParse(formInput(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { id, ...details } = parsed.data

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }
  if (!(await isUserAccount(id))) return { error: "This user account could not be found." }

  const fieldErrors = await validateProfile(details, id)
  if (fieldErrors) return { fieldErrors }

  const { error } = await admin.from("profiles").update(details).eq("id", id)
  if (error) {
    if (error.code === "23505") return { fieldErrors: { student_id: "Another account already uses this student ID." } }
    console.error("updateUser: profile update failed", error.code)
    return { error: GENERIC_ERROR }
  }

  revalidate(id)
  redirect("/admin/users")
}

/**
 * Sets a new temporary password in Supabase Auth and requires a change on next login.
 * Auth's password-change trigger clears must_change_password, so it is set again afterwards.
 */
export async function resetUserPassword(id: string, _prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  await requireAdmin()
  const parsed = password.safeParse(formData.get("password"))
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0]?.message ?? "Enter a valid password." } }
  if (!z.uuid().safeParse(id).success || !(await isUserAccount(id))) return { error: "This user account could not be found." }

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  const { error: authError } = await admin.auth.admin.updateUserById(id, { password: parsed.data })
  if (authError) {
    if (authError.code === "weak_password") return { fieldErrors: { password: "This password is too weak. Use a longer one with letters and numbers." } }
    console.error("resetUserPassword: auth update failed", authError.code)
    return { error: "The password could not be reset. Please try again." }
  }

  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", id)
  revalidate(id)
  if (flagError) {
    console.error("resetUserPassword: flag update failed", flagError.code)
    return { error: "The password was reset, but the user won't be asked to change it. Reset it again to retry." }
  }

  const supabase = await createClient()
  const { data: user } = await supabase.from("profiles").select("full_name, email").eq("id", id).single()
  const email = user?.email ?? ""
  const emailStatus = email
    ? await emailSignInDetails({ fullName: user?.full_name ?? email, email }, parsed.data, "reset")
    : "failed"
  return { temporaryPassword: parsed.data, email, emailStatus }
}
