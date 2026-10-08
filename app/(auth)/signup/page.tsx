import Link from "next/link"
import { redirect } from "next/navigation"

import { SignupForm } from "@/components/auth/signup-form"
import { getCurrentProfile, nextPathFor } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

export default async function SignupPage() {
  const [profile, { assistantName }] = await Promise.all([getCurrentProfile(), getBranding()])
  if (profile) redirect(nextPathFor(profile))

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
        Keep asking {assistantName} and save your conversations.
      </p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-150 outline-none hover:text-primary/80 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          Sign in
        </Link>
      </p>
    </>
  )
}
