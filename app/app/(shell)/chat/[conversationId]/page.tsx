import { redirect } from "next/navigation"

import { ChatView } from "@/components/assistant/chat-view"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { getConversation } from "@/lib/chat"

export default async function ConversationPage({ params }: PageProps<"/app/chat/[conversationId]">) {
  const [profile, { assistantName }, { conversationId }] = await Promise.all([
    requireProfile(),
    getBranding(),
    params,
  ])
  // RLS only returns the student's own conversations. A deleted, foreign, or malformed id
  // goes back to a new conversation instead of an error page.
  const data = /^[0-9a-f-]{36}$/i.test(conversationId) ? await getConversation(conversationId) : null
  if (!data) redirect("/app")

  return (
    <ChatView
      key={conversationId}
      conversationId={conversationId}
      initialMessages={data.messages}
      assistantName={assistantName}
      firstName={profile.full_name?.split(/\s+/)[0] ?? null}
      suggestions={[]}
    />
  )
}
