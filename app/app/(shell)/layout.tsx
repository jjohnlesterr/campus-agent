import { redirect } from "next/navigation"

import { StudentShell } from "@/components/student/student-shell"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { getRecentConversations } from "@/lib/chat"
import { createClient } from "@/lib/supabase/server"

export default async function StudentShellLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  if (profile.role === "student" && !profile.onboarded_at) redirect("/app/onboarding")

  const supabase = await createClient()
  const [{ assistantName }, recentConversations, { data: program }] = await Promise.all([
    getBranding(),
    getRecentConversations(),
    profile.program_id
      ? supabase.from("programs").select("code").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <StudentShell
      assistantName={assistantName}
      recentConversations={recentConversations}
      user={{
        name: profile.full_name ?? profile.email ?? "Student",
        detail: [program?.code, profile.year_level ? `Year ${profile.year_level}` : null]
          .filter(Boolean)
          .join(" · ") || (profile.role === "admin" ? "Administrator" : null),
      }}
    >
      {children}
    </StudentShell>
  )
}
