"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { getCurrentProfile, nextPathFor } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Accounts are provisioned by an administrator — there is no public sign-up.

export type AuthFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

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
          ? "This account hasn't been activated yet. Contact your administrator."
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
