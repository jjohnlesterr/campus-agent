import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingNav } from "@/components/landing/landing-nav"
import { getCurrentProfile, homePathFor } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

// Public Guides: same header and footer as the landing page, no sign-in required.
export default async function PublicGuidesLayout({ children }: { children: React.ReactNode }) {
  const [{ assistantName }, profile] = await Promise.all([getBranding(), getCurrentProfile()])
  return (
    <div className="landing-page flex flex-1 flex-col bg-background">
      <LandingNav
        account={profile ? { homeHref: homePathFor(profile.role), profileHref: profile.role === "admin" ? null : "/app/profile" } : null}
      />
      <main className="flex-1">{children}</main>
      <LandingFooter assistantName={assistantName} />
    </div>
  )
}
