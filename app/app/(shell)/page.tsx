import { ChatView } from "@/components/assistant/chat-view"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

const QUICK_QUESTIONS = [
  "How do I fix an INC?",
  "What are the graduation honors requirements?",
  "How do I transfer to another school?",
  "What documents can I request?",
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
