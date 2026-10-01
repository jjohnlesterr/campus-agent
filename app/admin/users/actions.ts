"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { buildAccountEmail } from "@/lib/email/account-email"
import { type SendFailure, sendEmail } from "@/lib/email/send"
import { type FormState, optionalUuid, toFieldErrors } from "@/lib/forms"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const NOT_CONFIGURED = "Student accounts can't be managed yet: the server is missing SUPABASE_SERVICE_ROLE_KEY."
const GENERIC_ERROR = "The account could not be saved. Please try again."
const DUPLICATE_EMAIL = "A student account with this email already exists."

const password = z.string().trim().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer.")

const profileFields = z.object({
  full_name: z.string().trim().min(2, "Enter the student's full name.").max(120),
  student_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,30}$/, "Use 3–30 letters, numbers or dashes."),
  department_id: z.uuid("Choose a department."),
  program_id: optionalUuid,
  year_level: z.coerce.number().int().min(1, "Choose a year level.").max(6, "Choose a year level."),
})

const createSchema = profileFields.extend({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid school email.")),
  password,
})

const updateSchema = profileFields.extend({ id: z.uuid() })

/** Whether the sign-in details email went out. Reported to the admin, never assumed. */
export type EmailStatus = "sent" | SendFailure

export type CreateStudentState =
  | (NonNullable<FormState> & { created?: undefined })
  | { created: { fullName: string; email: string; temporaryPassword: string; emailStatus: EmailStatus } }
  | undefined

export type ResetPasswordState =
  | (NonNullable<FormState> & { temporaryPassword?: undefined })
  | { temporaryPassword: string; email: string; emailStatus: EmailStatus }
  | undefined

/**
 * The app's public base URL for email links: NEXT_PUBLIC_APP_URL (the Vercel URL in
 * production). Falls back to the host this request came in on, so local development works.
 */
async function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return new URL(process.env.NEXT_PUBLIC_APP_URL)
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https")
  return new URL(`${proto}://${host}`)
}

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

/** Program must belong to the department; student ID must be free. Uses the admin's own session (RLS). */
async function validateProfile(input: z.infer<typeof profileFields>, exceptId?: string): Promise<Record<string, string> | null> {
  const supabase = await createClient()
  if (input.program_id) {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("id", input.program_id)
      .eq("department_id", input.department_id)
      .maybeSingle()
    if (!program) return { program_id: "Choose a program from the selected department." }
  }
  let taken = supabase.from("profiles").select("id").eq("student_id", input.student_id)
  if (exceptId) taken = taken.neq("id", exceptId)
  const { data } = await taken.maybeSingle()
  if (data) return { student_id: "Another account already uses this student ID." }
  return null
}

/** Only student accounts can be edited from Admin → Users — never an admin. */
async function isStudent(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle()
  return data?.role === "student"
}

/**
 * Provisions a student account. The password is handed to Supabase Auth only —
 * it is never written to profiles or any custom table. It is returned once in
 * this response so the admin can share it; the student must change it on first login.
 */
export async function createStudent(_prev: CreateStudentState, formData: FormData): Promise<CreateStudentState> {
  await requireAdmin()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { password, email, ...student } = parsed.data

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  const fieldErrors = await validateProfile(student)
  if (fieldErrors) return { fieldErrors }
  // Profiles mirror every Auth account's email, so an existing account is caught before Auth is touched.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (existing) return { fieldErrors: { email: DUPLICATE_EMAIL } }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // admin-provisioned school email; no confirmation email
    user_metadata: { full_name: student.full_name },
  })
  if (authError || !created.user) {
    if (authError?.code === "email_exists") return { fieldErrors: { email: DUPLICATE_EMAIL } }
    if (authError?.code === "weak_password") return { fieldErrors: { password: "This password is too weak. Use a longer one with letters and numbers." } }
    console.error("createStudent: auth user creation failed", authError?.code)
    return { error: GENERIC_ERROR }
  }

  // The signup trigger already created the profile (role defaults to student, email copied from Auth).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ ...student, must_change_password: true })
    .eq("id", created.user.id)
  if (profileError) {
    // Don't leave a half-provisioned login behind.
    await admin.auth.admin.deleteUser(created.user.id)
    if (profileError.code === "23505") return { fieldErrors: { student_id: "Another account already uses this student ID." } }
    console.error("createStudent: profile update failed", profileError.code)
    return { error: GENERIC_ERROR }
  }

  revalidate()
  // The account is complete at this point; a failed email never undoes it.
  const emailStatus = await emailSignInDetails({ fullName: student.full_name, email }, password, "created")
  return { created: { fullName: student.full_name, email, temporaryPassword: password, emailStatus } }
}

/** Edits a student's provisioned details. Email (the sign-in identity) is not changed here. */
export async function updateStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { id, ...student } = parsed.data

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }
  if (!(await isStudent(id))) return { error: "This student account could not be found." }

  const fieldErrors = await validateProfile(student, id)
  if (fieldErrors) return { fieldErrors }

  const { error } = await admin.from("profiles").update(student).eq("id", id)
  if (error) {
    if (error.code === "23505") return { fieldErrors: { student_id: "Another account already uses this student ID." } }
    console.error("updateStudent: profile update failed", error.code)
    return { error: GENERIC_ERROR }
  }

  revalidate(id)
  redirect("/admin/users")
}

/**
 * Sets a new temporary password in Supabase Auth and requires a change on next login.
 * Auth's password-change trigger clears must_change_password, so it is set again afterwards.
 */
export async function resetStudentPassword(id: string, _prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  await requireAdmin()
  const parsed = password.safeParse(formData.get("password"))
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0]?.message ?? "Enter a valid password." } }
  if (!z.uuid().safeParse(id).success || !(await isStudent(id))) return { error: "This student account could not be found." }

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  const { error: authError } = await admin.auth.admin.updateUserById(id, { password: parsed.data })
  if (authError) {
    if (authError.code === "weak_password") return { fieldErrors: { password: "This password is too weak. Use a longer one with letters and numbers." } }
    console.error("resetStudentPassword: auth update failed", authError.code)
    return { error: "The password could not be reset. Please try again." }
  }

  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", id)
  revalidate(id)
  if (flagError) {
    console.error("resetStudentPassword: flag update failed", flagError.code)
    return { error: "The password was reset, but the student won't be asked to change it. Reset it again to retry." }
  }

  const supabase = await createClient()
  const { data: student } = await supabase.from("profiles").select("full_name, email").eq("id", id).single()
  const email = student?.email ?? ""
  const emailStatus = email
    ? await emailSignInDetails({ fullName: student?.full_name ?? email, email }, parsed.data, "reset")
    : "failed"
  return { temporaryPassword: parsed.data, email, emailStatus }
}
