import { z } from "zod"

export type SourceSection = { id: string; chunk_index: number; page_number: number | null; section_title: string | null; content: string }
export type GuideStep = { title: string; description: string }
export type GuideTopic = { key: string; title: string; description: string; sections: SourceSection[]; requirements: string[]; steps: GuideStep[] }

export function cleanTopicTitle(title: string) {
  return title.trim().replace(/^(?:\d{1,3}(?:\.\d+)*[.)]?|[IVXLCDM]+[.)])\s+/i, "").replace(/\s+/g, " ")
}

export function topicKey(title: string) {
  return cleanTopicTitle(title).normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

const referenceSchema = z.object({
  version: z.literal(1), topic: z.string(),
  chunkIds: z.array(z.uuid()), pages: z.array(z.number().int().positive()),
})
export type GuideReference = z.infer<typeof referenceSchema>
export function readGuideReference(value: string | null): GuideReference | null {
  try { const parsed = referenceSchema.safeParse(JSON.parse(value ?? "")); return parsed.success ? parsed.data : null } catch { return null }
}
export function pageLabel(pages: number[]) {
  return pages.length ? `${pages.length === 1 ? "Page" : "Pages"} ${[...new Set(pages)].sort((a, b) => a - b).join(", ")}` : "Page not recorded"
}
export function referenceLabel(value: string | null) {
  const ref = readGuideReference(value)
  return ref ? pageLabel(ref.pages) : value ?? "Source reference not recorded"
}
export function topicReference(topic: GuideTopic): GuideReference {
  return { version: 1, topic: topic.key, chunkIds: topic.sections.map(s => s.id), pages: [...new Set(topic.sections.flatMap(s => s.page_number ? [s.page_number] : []))].sort((a, b) => a - b) }
}

// Preserve source sentences, including statements that a procedure is unspecified.
// Do not turn unordered policy bullets into a sequence of procedural steps.
function numberedSteps(content: string): GuideStep[] {
  const matches = [...content.matchAll(/(?:^|\s)(\d+)\.\s+(?=[A-Z])/g)]
  const start = matches.findIndex(m => m[1] === "1")
  if (start < 0) return []
  const sequence = matches.slice(start)
  if (sequence.length < 2 || sequence.some((m, i) => Number(m[1]) !== i + 1)) return []
  return sequence.map((m, i) => {
    const from = m.index! + m[0].length
    const segment = content.slice(from, sequence[i + 1]?.index ?? content.length).trim()
    // A numbered instruction ends at its first sentence; trailing policy stays in the evidence.
    const sentence = segment.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? segment
    return { title: sentence.slice(0, 200), description: sentence.length > 200 ? sentence : "" }
  })
}

export function groupSourceSections(sections: SourceSection[]): GuideTopic[] {
  const groups = new Map<string, GuideTopic>()
  let previousKey: string | null = null
  for (const section of [...sections].sort((a, b) => a.chunk_index - b.chunk_index)) {
    if (!section.content.trim()) continue
    const title = section.section_title?.trim() ? cleanTopicTitle(section.section_title) : null
    const key: string | null = title ? topicKey(title) : previousKey
    // An unlabelled continuation joins the preceding topic, not an invented topic.
    if (!key) continue
    if (!groups.has(key)) groups.set(key, { key, title: title!, description: "", sections: [], steps: [], requirements: [] })
    groups.get(key)!.sections.push(section)
    previousKey = key
  }
  for (const topic of groups.values()) {
    const text = topic.sections.map(s => s.content).join("\n\n")
    const first = topic.sections[0]
    const heading = first.section_title?.trim()
    // Drop the supplied heading when present; everything else is a verbatim excerpt.
    const body = heading && first.content.includes(heading) ? first.content.slice(first.content.indexOf(heading) + heading.length).trim() : first.content.trim()
    topic.description = body.length > 360 ? `${body.slice(0, 357).trimEnd()}…` : body
    const seenSteps = new Set<string>()
    topic.steps = topic.sections.flatMap(s => numberedSteps(s.content)).filter(step => {
      const key = `${step.title}\u0000${step.description}`
      if (seenSteps.has(key)) return false
      seenSteps.add(key)
      return true
    })
    const explicit = text.match(/\bRequirements:\s*([\s\S]+)/i)?.[1]
    if (explicit) topic.requirements = explicit.split(/[??•]/).map(s => s.trim()).filter(Boolean)
  }
  return [...groups.values()]
}

export function supportsOffice(sections: Pick<SourceSection, "content">[], office: { name: string; short_name: string | null }) {
  return namesOffice(sections.map(s => s.content).join(" "), office)
}

/** True when the text explicitly names the office (full or short name). */
export function namesOffice(text: string, office: { name: string; short_name: string | null }) {
  const content = topicKey(text)
  return [office.name, office.short_name].some(name => name && name.length >= 3 && (` ${content} `).includes(` ${topicKey(name)} `))
}

export function libraryOptions(status: unknown, sort: unknown) {
  return {
    status: status === "published" || status === "draft" ? status : "all",
    sort: sort === "oldest" || sort === "az" ? sort : "newest",
  } as const
}
