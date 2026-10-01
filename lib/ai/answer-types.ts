// Shape of a Campus Agent answer, shared by the server (generation, storage)
// and the client (rendering). Stored in messages.response_metadata.

export type AnswerStatus = "answered" | "partial" | "not_found" | "error"

export type AnswerSource = {
  /** e.g. "Student Handbook — Page 1" */
  label: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
}

/** Location answers: which numbered map buildings they refer to, and whether a map can be shown. */
export type LocationInfo = {
  buildingNumbers: number[]
  mapAvailable: boolean
}

export type StructuredAnswer = {
  status: AnswerStatus
  /** One or two sentences that directly answer the question. */
  summary: string
  /** Ordered steps, only when the source states a procedure. */
  steps: string[]
  /** Requirements, conditions, documents or fees the source lists. */
  requirements: string[]
  /** Other relevant information as short Markdown (bullets allowed). */
  details: string
  /** What the source does not cover, if anything. */
  gaps: string
  sources: AnswerSource[]
  /** Present only on campus location answers. */
  location?: LocationInfo
  /** A follow-up page for structured answers, e.g. "View all events" → /app/events. */
  link?: { label: string; href: string }
}

/** Plain Markdown version of an answer (stored as messages.content). */
export function answerToMarkdown(a: StructuredAnswer) {
  const parts = [a.summary]
  if (a.steps.length) parts.push(a.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"))
  if (a.requirements.length) parts.push(`**Requirements**\n${a.requirements.map((r) => `- ${r}`).join("\n")}`)
  if (a.details) {
    parts.push(a.steps.length || a.requirements.length ? `**Good to know**\n${a.details}` : a.details)
  }
  if (a.gaps) parts.push(`**Not covered by the handbook:** ${a.gaps}`)
  if (a.sources.length) parts.push(`Source: ${a.sources.map((s) => s.label).join("; ")}`)
  return parts.filter(Boolean).join("\n\n")
}
