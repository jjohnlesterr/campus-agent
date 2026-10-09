import { redirect } from "next/navigation"

import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { getCurrentProfile } from "@/lib/auth"

// Opened from a password-reset email: /auth/confirm verified the link and signed the user
// in, so they can choose a new password here. Without a session the link was invalid or
// already used.
export default async function ResetPasswordPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login?error=confirm")

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {profile.full_name ? `Hi ${profile.full_name.split(/\s+/)[0]}. ` : ""}Set a new password for your account to continue.
      </p>
      <ChangePasswordForm email={profile.email} />
      <div className="mt-4 flex justify-center">
        <SignOutButton />
      </div>
    </>
  )
}
