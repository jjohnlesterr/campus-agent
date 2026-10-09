"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { appUrl } from "@/lib/app-url"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { buildPasswordResetEmail } from "@/lib/email/account-email"
import { sendEmail } from "@/lib/email/send"
import { type FormState, toFieldErrors } from "@/lib/forms"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Admin → Users: an account and profile directory (not a student information system).
// People normally create their own accounts through public sign-up; creating one here is
// the secondary, manual path (a Supabase invitation; the user sets their own password). Only non-admin
// accounts (role "user") are edited — never an admin, and the role
// itself is never changed here. Only the full name is written; older profile columns
// (user type, college, program, student ID, year level) are never read or changed here.

const NOT_CONFIGURED = "User accounts can't be managed yet: the server is missing SUPABASE_SERVICE_ROLE_KEY."
const GENERIC_ERROR = "The account could not be saved. Please try again."
const DUPLICATE_EMAIL = "An account with this email already exists."

const profileFields = z.object({
  full_name: z.string().trim().min(2, "Enter the user's full name.").max(120),
})

const inviteSchema = profileFields.extend({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
})

const updateSchema = profileFields.extend({ id: z.uuid() })

/** Form values with optional fields defaulted — disabled or omitted selects aren't submitted. */
function formInput(formData: FormData) {
  return Object.fromEntries(formData)
}

export type InviteUserState = (NonNullable<FormState> & { invited?: undefined }) | { invited: { email: string } } | undefined

/** Where the invitation email's link lands: /accept-invite starts the session, then the user sets a password. */
async function inviteRedirect() {
  return new URL("/accept-invite", await appUrl()).toString()
}

function revalidate(id?: string) {
  revalidatePath("/admin/users")
  revalidatePath("/admin")
  if (id) revalidatePath(`/admin/users/${id}`)
}

/** Only role "user" accounts can be edited from Admin → Users — never an admin. */
async function isUserAccount(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle()
  return data?.role === "user"
}

/**
 * Manually creates an account by invitation. Supabase Auth creates the user and sends its
 * built-in invitation email; the link lets the user choose their own password. No password
 * is generated, shown, stored or emailed by Campus Agent. The signup trigger creates the
 * profile with role "user" and must_change_password = true ("awaiting first login"); Auth's
 * password-change trigger clears it once the user sets a password.
 */
export async function inviteUser(_prev: InviteUserState, formData: FormData): Promise<InviteUserState> {
  await requireAdmin()
  const parsed = inviteSchema.safeParse(formInput(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { email, full_name } = parsed.data

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  // Profiles mirror every Auth account's email, so an existing account is caught before Auth is touched.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (existing) return { fieldErrors: { email: DUPLICATE_EMAIL } }

  const { data: invited, error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: await inviteRedirect(),
  })
  if (authError || !invited.user) {
    if (authError?.code === "email_exists" || authError?.status === 422) return { fieldErrors: { email: DUPLICATE_EMAIL } }
    console.error("inviteUser: invitation failed", authError?.code ?? authError?.status)
    return { error: "The invitation could not be sent. Please try again." }
  }

  // Role is never set here: the database default is "user". The flag marks it as awaiting first login.
  const { error: profileError } = await admin.from("profiles").update({ full_name, must_change_password: true }).eq("id", invited.user.id)
  if (profileError) {
    // Don't leave a half-provisioned account behind.
    await admin.auth.admin.deleteUser(invited.user.id)
    console.error("inviteUser: profile update failed", profileError.code)
    return { error: GENERIC_ERROR }
  }

  revalidate()
  return { invited: { email } }
}

/** Edits a user's full name. Email (the sign-in identity) and role are not changed here. */
export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = updateSchema.safeParse(formInput(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }
  const { id, ...details } = parsed.data

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }
  if (!(await isUserAccount(id))) return { error: "This user account could not be found." }

  const { error } = await admin.from("profiles").update(details).eq("id", id)
  if (error) {
    console.error("updateUser: profile update failed", error.code)
    return { error: GENERIC_ERROR }
  }

  revalidate(id)
  redirect("/admin/users")
}

// ---------- Account actions (one regular account; never the signed-in admin) ----------

export type AccountActionResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * The target must be a regular account (role "user") and never the admin doing this, so
 * no admin can lock out, reset or delete themselves (or another admin) from this page.
 */
async function managedAccount(id: string) {
  const me = await requireAdmin()
  if (!z.uuid().safeParse(id).success || id === me.id) return null
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("id, role, full_name, email, deactivated_at").eq("id", id).maybeSingle()
  return data?.role === "user" ? data : null
}

const NOT_FOUND = "This user account could not be found."

/**
 * Sends a password-reset email to the user's sign-in email. Supabase Auth creates a
 * one-time recovery link (it opens "Choose a new password"); the password itself is
 * never seen or set by the admin.
 */
export async function sendPasswordReset(id: string): Promise<AccountActionResult> {
  const user = await managedAccount(id)
  if (!user?.email) return { ok: false, error: NOT_FOUND }
  if (user.deactivated_at) return { ok: false, error: "Reactivate this account before sending a password reset." }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: NOT_CONFIGURED }

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: user.email })
  const token = data?.properties?.hashed_token
  if (error || !token) {
    console.error("sendPasswordReset: recovery link failed", error?.code)
    return { ok: false, error: "The password reset could not be started. Please try again." }
  }
  try {
    const [{ assistantName }, base] = await Promise.all([getBranding(), appUrl()])
    const resetUrl = new URL("/auth/confirm", base)
    resetUrl.searchParams.set("token_hash", token)
    resetUrl.searchParams.set("type", "recovery")
    const logoUrl = base.protocol === "https:" ? new URL("/assets/logo.png", base).toString() : undefined
    const message = buildPasswordResetEmail({ fullName: user.full_name ?? user.email, resetUrl: resetUrl.toString(), assistantName, logoUrl })
    const sent = await sendEmail({ to: user.email, ...message })
    if (!sent.ok) {
      return {
        ok: false,
        error: sent.reason === "failed"
          ? "The password reset email couldn't be delivered right now. Please try again."
          : "Email delivery is unavailable in this environment, so the password reset email wasn't sent.",
      }
    }
  } catch {
    console.error("sendPasswordReset: could not prepare the email")
    return { ok: false, error: "The password reset email couldn't be sent. Please try again." }
  }
  return { ok: true, message: `Password reset email sent to ${user.email}.` }
}

/**
 * Deactivate: the Auth user is banned (no sign-in or session refresh) and the profile is
 * marked, so the app also stops accepting a session that is still open. Reactivate undoes
 * both. The account and all its data are kept.
 */
export async function setAccountActive(id: string, active: boolean): Promise<AccountActionResult> {
  const user = await managedAccount(id)
  if (!user) return { ok: false, error: NOT_FOUND }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: NOT_CONFIGURED }

  const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" })
  if (authError) {
    console.error("setAccountActive: auth update failed", authError.code)
    return { ok: false, error: `The account could not be ${active ? "reactivated" : "deactivated"}. Please try again.` }
  }
  const { error } = await admin.from("profiles").update({ deactivated_at: active ? null : new Date().toISOString() }).eq("id", id)
  if (error) {
    console.error("setAccountActive: profile update failed", error.code)
    return { ok: false, error: `The account was ${active ? "reactivated" : "deactivated"} for sign-in, but its status couldn't be saved. Try again.` }
  }
  revalidate(id)
  return { ok: true, message: active ? "Account reactivated." : "Account deactivated." }
}

/**
 * Permanently deletes the Supabase Auth user. The profile and the user's own conversations
 * are removed by the existing ON DELETE CASCADE; records they don't own (e.g. sources an
 * admin uploaded) only lose their link. Nothing else is deleted.
 */
export async function deleteAccount(id: string): Promise<AccountActionResult> {
  const user = await managedAccount(id)
  if (!user) return { ok: false, error: NOT_FOUND }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: NOT_CONFIGURED }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    console.error("deleteAccount: auth delete failed", error.code)
    return { ok: false, error: "The account could not be deleted. Please try again." }
  }
  revalidate()
  return { ok: true, message: "Account deleted." }
}

/**
 * Sends the Supabase invitation email again to an account that is still awaiting first
 * login (e.g. the first link expired). Uses the same built-in invitation as inviteUser.
 */
export async function resendInvitation(id: string): Promise<AccountActionResult> {
  const user = await managedAccount(id)
  if (!user?.email) return { ok: false, error: NOT_FOUND }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: NOT_CONFIGURED }
  const { data: profile } = await admin.from("profiles").select("must_change_password").eq("id", id).maybeSingle()
  if (!profile?.must_change_password) return { ok: false, error: "This account has already set a password. Send a reset link instead." }

  const { error } = await admin.auth.admin.inviteUserByEmail(user.email, { data: { full_name: user.full_name }, redirectTo: await inviteRedirect() })
  if (error) {
    console.error("resendInvitation: invitation failed", error.code ?? error.status)
    return {
      ok: false,
      error: error.code === "email_exists" || error.status === 422
        ? "Supabase can't re-invite this account. Send a password reset link instead."
        : "The invitation could not be sent. Please try again.",
    }
  }
  return { ok: true, message: `Invitation sent to ${user.email}.` }
}
