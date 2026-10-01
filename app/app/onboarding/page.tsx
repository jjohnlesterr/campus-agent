import { redirect } from "next/navigation"

import { getProfileOptions } from "@/app/app/(shell)/profile/profile-data"
import { AppHeader } from "@/components/shared/app-header"
import { ProfileForm } from "@/components/student/profile-form"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

export default async function OnboardingPage() {
  const profile = await requireProfile()
  if (profile.onboarded_at) redirect("/app")

  const [{ departments, programs }, { assistantName }] = await Promise.all([
    getProfileOptions(),
    getBranding(),
  ])

  return (
    <>
      <AppHeader href="/app/onboarding" label={assistantName} email={profile.email} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
          Your college and program help {assistantName} show the most relevant information first.
          You can still see every college&apos;s events and announcements.
        </p>
        <ProfileForm
          profile={profile}
          departments={departments}
          programs={programs}
          submitLabel="Continue"
        />
      </main>
    </>
  )
}
