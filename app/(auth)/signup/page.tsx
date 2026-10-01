import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getCurrentProfile, homePathFor } from "@/lib/auth"

export default async function SignupPage() {
  const profile = await getCurrentProfile()
  if (profile) redirect(homePathFor(profile.role))

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Sign up with your school email. You&apos;ll add your student details next.
      </p>
      <AuthForm mode="signup" />
    </>
  )
}
