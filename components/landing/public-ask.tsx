"use client"

import { QuestionComposer } from "@/components/assistant/question-composer"
import { publicScopeReply } from "@/lib/ai/public-scope"

// Public ask box: general information for applicants, incoming students and visitors.
// Current-student questions (INC, grades, clearance…) get a local sign-in reply — no AI call.
export function PublicAsk({ suggestions }: { suggestions: string[] }) {
  return (
    <QuestionComposer
      size="large"
      placeholder="Ask about admission, enrollment, programs, or campus offices..."
      suggestions={suggestions}
      respond={publicScopeReply}
      notConnectedMessage="Public answers are coming soon. Current students can sign in to ask Campus Agent today."
    />
  )
}
