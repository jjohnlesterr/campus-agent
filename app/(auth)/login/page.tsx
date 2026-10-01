import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getCurrentProfile, homePathFor } from "@/lib/auth"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const profile = await getCurrentProfile()
  if (profile) redirect(homePathFor(profile.role))

  const { error } = await searchParams

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Use your school account to continue to Campus Agent.
      </p>
      {error === "confirm" && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          That confirmation link is invalid or has expired. Sign in or create your account again.
        </p>
      )}
      <AuthForm mode="login" />
    </>
  )
}
