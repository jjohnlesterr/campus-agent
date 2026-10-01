import { redirect } from "next/navigation"

import { LoginForm } from "@/components/auth/login-form"
import { getCurrentProfile, nextPathFor } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [profile, { assistantName }] = await Promise.all([getCurrentProfile(), getBranding()])
  if (profile) redirect(nextPathFor(profile))

  const { error } = await searchParams

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to {assistantName}</h1>
      <p className="mt-1.5 mb-7 text-sm text-muted-foreground">Use the school account provided by your university.</p>
      {error === "confirm" && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          That link is invalid or has expired. Contact your administrator for a new one.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        Need help accessing your account? Contact your university administrator.
      </p>
    </>
  )
}
