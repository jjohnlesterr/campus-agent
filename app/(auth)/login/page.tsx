import Link from "next/link"
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
      <p className="mt-1.5 mb-7 text-sm text-muted-foreground">Sign in to continue to {assistantName}.</p>
      {error === "confirm" && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          That link is invalid or has expired. Try signing in, or create your account again.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to {assistantName}?{" "}
        <Link href="/signup" className="rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-150 outline-none hover:text-primary/80 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          Create an account
        </Link>
      </p>
    </>
  )
}
