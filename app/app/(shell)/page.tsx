import { ChatView } from "@/components/assistant/chat-view"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

// One per source Campus Agent answers from: School Guides, campus map, departments, announcements.
const QUICK_QUESTIONS = [
  "How do I enroll as a freshman?",
  "What are the transferee requirements?",
  "What scholarships are available?",
  "Where is the Registrar?",
  "What programs are offered?",
  "What are the latest announcements?",
]

// New conversation: an empty chat. The conversation is created with the first question.
export default async function StudentWorkspacePage() {
  const [profile, { assistantName }] = await Promise.all([requireProfile(), getBranding()])

  return (
    <ChatView
      conversationId={null}
      initialMessages={[]}
      assistantName={assistantName}
      firstName={profile.full_name?.split(/\s+/)[0] ?? null}
      suggestions={QUICK_QUESTIONS}
    />
  )
}
