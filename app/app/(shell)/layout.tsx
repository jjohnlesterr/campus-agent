import { StudentShell } from "@/components/student/student-shell"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { getRecentConversations } from "@/lib/chat"

// The signed-in user area. The account footer shows only the name and email: Campus Agent
// is for every university user and visitor, so no program, year level or student ID.
export default async function StudentShellLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  const [{ assistantName }, recentConversations] = await Promise.all([getBranding(), getRecentConversations()])

  return (
    <StudentShell
      assistantName={assistantName}
      recentConversations={recentConversations}
      user={{ name: profile.full_name?.trim() || profile.email || "Account", detail: profile.email || "Account" }}
    >
      {children}
    </StudentShell>
  )
}
