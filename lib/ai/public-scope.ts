// Public (landing page) assistant scope: general university information for
// applicants, incoming students, transferees and visitors. Questions about a
// current student's own academic record belong in the signed-in app, so they get
// a fixed sign-in reply — decided locally, with no AI call.

export const STUDENT_ONLY_MESSAGE =
  "For student-specific academic concerns, please sign in to Campus Agent using your university account."

// Applicant / visitor wording keeps a question public even if it shares words with a student topic
// ("What documents do transferees need?").
const PUBLIC_CONTEXT = /\b(?:admission|admissions|applicant|applicants|apply|application|freshm[ae]n|incoming|transferee|transferees|prospective|visitor|entrance)\b/

const STUDENT_ONLY = [
  /\binc\b/, /\bincomplete\b/,
  /\bmy (?:grades?|gwa|gpa|records?|transcript|tor|schedule|subjects?|classes|units|balance|account|enrollment status|clearance)\b/,
  /\b(?:grades?|marka|gwa|schedule|sched|subjects?|tor|record|balance) ko\b/,
  /\b(?:failed|failing|bagsak|bumagsak)\b/,
  /\bdean'?s list\b/, /\blatin honors?\b/, /\bcum laude\b/,
  /\b(?:graduation )?clearance\b/,
  /\b(?:shift|shifting|magshift|mag-shift)\b/,
  /\bleave of absence\b/, /\bloa\b/,
  /\b(?:drop|dropping|withdraw|withdrawal)\b/,
  /\b(?:tor|transcript of records)\b/,
  /\b(?:probation|suspension|violation|sanction)\b/,
]

/** The sign-in reply for current-student questions, or null when the question is public. */
export function publicScopeReply(question: string): string | null {
  const text = question.toLowerCase()
  if (PUBLIC_CONTEXT.test(text)) return null
  return STUDENT_ONLY.some((pattern) => pattern.test(text)) ? STUDENT_ONLY_MESSAGE : null
}
