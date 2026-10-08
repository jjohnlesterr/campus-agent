import { ChatView } from "@/components/assistant/chat-view"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

// Freshman and visitor topics first; published policy knowledge (INC, honors…) still answers.
const QUICK_QUESTIONS = [
  "How do I enroll as a freshman?",
  "What are the transferee requirements?",
  "Are there scholarships for incoming students?",
  "Where is the Registrar?",
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
