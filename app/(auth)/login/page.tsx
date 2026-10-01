import { redirect } from "next/navigation"

import { LoginForm } from "@/components/auth/login-form"
import { getCurrentProfile, nextPathFor } from "@/lib/auth"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const profile = await getCurrentProfile()
  if (profile) redirect(nextPathFor(profile))

  const { error } = await searchParams

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Use the school account provided by your university.
      </p>
      {error === "confirm" && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          That link is invalid or has expired. Contact your administrator for a new one.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Don&apos;t have an account or forgot your password? Contact your university administrator.
      </p>
    </>
  )
}
