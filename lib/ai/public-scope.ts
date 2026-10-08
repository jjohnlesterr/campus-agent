// Public (landing page) assistant scope. Guests may ask about anything Campus Agent
// has published publicly — admission, enrollment, programs, offices, announcements and
// general policies (INC, honors, shifting…). Campus Agent never has access to anyone's
// personal academic record, so questions about "my grades / my balance" get a fixed
// reply pointing to the right office — decided locally, with no AI call.

export const PERSONAL_RECORD_MESSAGE =
  "Campus Agent can't look up personal records such as grades, balances or schedules. For questions about your own record, please contact the Office of the Registrar or the office that handles it."

// Lookups of one person's own data only. Procedure questions that mention "my"
// ("How do I request my transcript?") stay general and are answered from sources.
const RECORD = "(?:grades?|gwa|gpa|balance|account balance|schedule|units|enrollment status)"
const PERSONAL_RECORD = [
  new RegExp(`\\bwhat(?:'s| is| are) my ${RECORD}\\b`),
  new RegExp(`\\b(?:show|check|see|view|give me) my ${RECORD}\\b`),
  /\b(?:ano|magkano) (?:ang |yung )?(?:grades?|marka|gwa|balance|sched|schedule) ko\b/,
  /\b(?:did i|have i) (?:pass|passed|fail|failed)\b/,
]

/** The fixed reply for questions about one person's own record, or null when the question is general. */
export function publicScopeReply(question: string): string | null {
  const text = question.toLowerCase()
  return PERSONAL_RECORD.some((pattern) => pattern.test(text)) ? PERSONAL_RECORD_MESSAGE : null
}
