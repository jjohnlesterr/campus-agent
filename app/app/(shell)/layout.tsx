import { StudentShell } from "@/components/student/student-shell"
import { personalProgramId, requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { getRecentConversations } from "@/lib/chat"
import { createClient } from "@/lib/supabase/server"
import { userTypeLabel } from "@/lib/user-types"

export default async function StudentShellLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()

  const supabase = await createClient()
  const programId = personalProgramId(profile)
  const [{ assistantName }, recentConversations, { data: program }] = await Promise.all([
    getBranding(),
    getRecentConversations(),
    programId
      ? supabase.from("programs").select("code").eq("id", programId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <StudentShell
      assistantName={assistantName}
      recentConversations={recentConversations}
      user={{
        name: profile.full_name ?? profile.email ?? "User",
        // e.g. "BSIT · Incoming Freshman"; older accounts may still show a year level.
        detail: [program?.code, userTypeLabel(profile.user_type) ?? (profile.year_level ? `Year ${profile.year_level}` : null)]
          .filter(Boolean)
          .join(" · ") || (profile.role === "admin" ? "Administrator" : null),
      }}
    >
      {children}
    </StudentShell>
  )
}
