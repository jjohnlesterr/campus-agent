import { getProfileOptions } from "@/app/app/(shell)/profile/profile-data"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileForm } from "@/components/student/profile-form"
import { requireProfile } from "@/lib/auth"

export default async function ProfilePage() {
  const profile = await requireProfile()
  const { departments, programs } = await getProfileOptions()

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Your profile"
        description="Keep your details up to date so Campus Agent can show your college's information first."
      />
      <div className="mt-8 max-w-md">
        <ProfileForm
          profile={profile}
          departments={departments}
          programs={programs}
          submitLabel="Save changes"
        />
      </div>
    </div>
  )
}
