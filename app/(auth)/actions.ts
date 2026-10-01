"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { homePathFor } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type AuthFormState = { error?: string; message?: string } | undefined

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

const signupSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
})

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again."
}

export async function login(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirm your email first — check your inbox for the link."
          : "Incorrect email or password.",
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single()

  redirect(homePathFor(profile?.role ?? "student"))
}

export async function signup(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const origin = (await headers()).get("origin")
  const supabase = await createClient()
  // Every new account is a student; the database ignores any role in signup data.
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  })
  if (error) {
    return {
      error:
        error.code === "user_already_exists"
          ? "An account with this email already exists. Sign in instead."
          : "We couldn't create your account. Please try again.",
    }
  }

  // Email confirmation off: signed in immediately. On: wait for the email link.
  if (data.session) redirect("/app/onboarding")
  return { message: "Check your email for a confirmation link, then sign in." }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
