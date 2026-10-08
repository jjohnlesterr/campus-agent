"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { appUrl } from "@/lib/app-url"
import { getCurrentProfile, nextPathFor } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Anyone can sign up with a name, email and password. Every new account gets the
// user role from the database signup trigger — a role is never accepted from the
// form. Admin accounts are authorized separately and can't be created here.

export type AuthFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

export type SignupState = (NonNullable<AuthFormState> & { confirmEmail?: undefined }) | { confirmEmail: string } | undefined

const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name.").max(120, "Use 120 characters or fewer."),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
    password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." })

/**
 * Public sign-up. Only the full name reaches Supabase Auth as metadata — anything
 * else in the form (e.g. a "role" field added by hand) is ignored. The signup
 * trigger always creates the profile with the user role. `signup_source: "self"`
 * only tells it the user chose this password, so no forced password change.
 */
export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message
    return { fieldErrors }
  }
  const { email, password, full_name } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, signup_source: "self" },
      emailRedirectTo: new URL("/auth/confirm", await appUrl()).toString(),
    },
  })
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { fieldErrors: { email: "An account with this email already exists. Sign in instead." } }
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "This password is too weak. Try a longer one with letters and numbers." } }
    }
    if (error.code === "signup_disabled") {
      // Supabase → Authentication → "Allow new users to sign up" is off for this project.
      console.error("signup failed: sign-ups are disabled in Supabase Auth settings")
      return { error: "Account sign-up isn't available right now. Please try again later." }
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { error: "Too many sign-up attempts right now. Please wait a few minutes and try again." }
    }
    console.error("signup failed", error.code)
    return { error: "Your account could not be created. Please try again." }
  }

  // Email confirmation on: no session until the link is opened.
  if (!data.session) return { confirmEmail: email }
  redirect("/app")
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." }
  const { email, password } = parsed.data

  const supabase = await createClient()
  let { data, error } = await supabase.auth.signInWithPassword({ email, password })
  // Temporary passwords are often copied with a stray space or line break. The exact
  // password is always tried first, so passwords that really contain spaces still work.
  const trimmed = password.trim()
  if (error?.code === "invalid_credentials" && trimmed && trimmed !== password) {
    ;({ data, error } = await supabase.auth.signInWithPassword({ email, password: trimmed }))
  }
  if (error || !data.user) {
    return {
      error:
        error?.code === "email_not_confirmed"
          ? "Confirm your email address first: open the link we sent to your inbox."
          : "Incorrect email or password.",
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", data.user.id)
    .single()

  redirect(nextPathFor(profile ?? { role: "student", must_change_password: false }))
}

const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." })

/**
 * Replaces a temporary password. The password is changed in Supabase Auth only;
 * a database trigger then clears profiles.must_change_password.
 */
export async function changePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message
    return { fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: "Choose a password different from your temporary password." } }
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "This password is too weak. Try a longer one with letters and numbers." } }
    }
    return { error: "Your password could not be changed. Please try again." }
  }

  redirect(nextPathFor({ role: profile.role, must_change_password: false }))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
