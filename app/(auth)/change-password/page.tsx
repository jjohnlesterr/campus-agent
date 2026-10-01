import { redirect } from "next/navigation"

import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { getCurrentProfile, homePathFor } from "@/lib/auth"

// First-login step for accounts created with a temporary password.
export default async function ChangePasswordPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  if (!profile.must_change_password) redirect(homePathFor(profile.role))

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {profile.full_name ? `Welcome, ${profile.full_name.split(/\s+/)[0]}. ` : ""}You signed in with a temporary
        password. Choose a new one to continue.
      </p>
      <ChangePasswordForm email={profile.email} />
      <div className="mt-4 flex justify-center">
        <SignOutButton />
      </div>
    </>
  )
}
