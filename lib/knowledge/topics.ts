import { z } from "zod"

import { type LineSegment, type ProposedTable, layoutLines, verifyTable } from "@/lib/knowledge/tables"
import type { LayoutItem } from "@/lib/rag/extract"

export type SourceSection = { id: string; chunk_index: number; page_number: number | null; section_title: string | null; content: string }
export type GuideStep = { title: string; description: string }
export type GuideTopic = {
  key: string
  title: string
  description: string
  /** Chunks the topic covers (retrieval references). */
  sections: SourceSection[]
  /** Verbatim source text of the topic, without duplicated chunk overlap. */
  content: string
  /** Source pages the topic spans (empty for text sources). */
  pages: number[]
  /** Heading the topic sits under in the source, when it is a subsection ("Academic Regulations"). */
  parent: string
  requirements: string[]
  steps: GuideStep[]
  /** A table in the topic could not be rebuilt faithfully; it is kept as source text for review. */
  tableReview?: boolean
  /** A numbered procedure in the topic looks malformed or cut off; it is kept as source text for review. */
  procedureReview?: boolean
}

export function cleanTopicTitle(title: string) {
  return title.trim().replace(/^(?:\d{1,3}(?:\.\d+)*[.)]?|[IVXLCDM]+[.)]|[A-Z][.)])\s+/i, "").replace(/\s+/g, " ")
}

export function topicKey(title: string) {
  return cleanTopicTitle(title).normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

const referenceSchema = z.object({
  version: z.literal(1), topic: z.string(),
  chunkIds: z.array(z.uuid()), pages: z.array(z.number().int().positive()),
  /** Set by Analyze with AI: fingerprint of the generated title and content. Admin edits drop it. */
  contentHash: z.string().optional(),
  /** Set by Analyze with AI when a table was kept as source text: check it against the PDF. */
  tableReview: z.boolean().optional(),
  /** Set by Analyze with AI when a numbered procedure looks malformed or cut off: check it against the source. */
  procedureReview: z.boolean().optional(),
})
export type GuideReference = z.infer<typeof referenceSchema>
export function readGuideReference(value: string | null): GuideReference | null {
  try { const parsed = referenceSchema.safeParse(JSON.parse(value ?? "")); return parsed.success ? parsed.data : null } catch { return null }
}
export function pageLabel(pages: number[]) {
  return pages.length ? `${pages.length === 1 ? "Page" : "Pages"} ${[...new Set(pages)].sort((a, b) => a - b).join(", ")}` : "Page not recorded"
}
/** Pages of a source section, or a manual entry's note. Null for text-source sections (no pages). */
export function referenceLabel(value: string | null) {
  const ref = readGuideReference(value)
  if (ref) return ref.pages.length ? pageLabel(ref.pages) : null
  return value ?? "Source reference not recorded"
}
export function topicReference(topic: GuideTopic): GuideReference {
  return { version: 1, topic: topic.key, chunkIds: topic.sections.map(s => s.id), pages: topic.pages, ...(topic.tableReview && { tableReview: true }), ...(topic.procedureReview && { procedureReview: true }) }
}

const sortedPages = (pages: (number | null)[]) => [...new Set(pages.filter((p): p is number => !!p))].sort((a, b) => a - b)

/**
 * Joins consecutive chunks without repeating the overlap the chunker carries into the
 * next chunk ("…rule. | rule. Next…"), so section content has no duplicated text.
 */
export function joinChunks(contents: string[]) {
  return contents.reduce((joined, next) => {
    if (!joined) return next.trim()
    const text = next.trim()
    for (let size = Math.min(joined.length, text.length, 400); size >= 20; size--) {
      if (joined.endsWith(text.slice(0, size))) return `${joined}\n\n${text.slice(size).trim()}`.trim()
    }
    return `${joined}\n\n${text}`
  }, "")
}

// A procedure the source states itself (a heading or label such as "Procedures for
// Hearing Complaints", "the following steps:", "Guidelines", followed by a numbered list)
// already sits, in order and in the source's own wording, in the section's verbatim
// content. Analysis therefore never copies it into a separate Steps block: that would
// repeat the same facts, and shortened copies lose text. Steps are never derived from
// prose either, since that cannot be done without rewording the source.
const PROCEDURE_LABEL = /\b(?:steps|procedures?|process(?:es)?|guidelines|workflow)\b/i

/**
 * True when an explicit numbered procedure looks malformed or cut off in the extracted
 * text: the numbering skips or repeats, an item ends mid-sentence before the next one,
 * or an item leaves a parenthesis open ("five (5"). The text is kept as it is and the
 * section is flagged so an admin checks it against the source; nothing is filled in.
 */
export function procedureNeedsReview(content: string) {
  const label = content.match(PROCEDURE_LABEL)
  if (!label) return false
  const text = content.slice(label.index!)
  const items = [...text.matchAll(/^[ \t]*(\d{1,2})[.)][ \t]+\S/gm)]
  const first = items.findIndex(m => m[1] === "1")
  if (first < 0) return false
  const list = items.slice(first)
  if (list.length < 2) return false
  return list.some((item, i) => {
    const number = Number(item[1])
    // A later list may start again at 1; any other break in the numbering is suspect.
    if (i > 0 && number !== 1 && number !== Number(list[i - 1][1]) + 1) return true
    const segment = text.slice(item.index!, list[i + 1]?.index ?? text.length).trim()
    if ((segment.match(/\(/g)?.length ?? 0) > (segment.match(/\)/g)?.length ?? 0)) return true
    if (i === list.length - 1) return false // the last item may run into the text that follows
    const lastLine = segment.split("\n").at(-1)!.trim()
    return !/^[•▪◦·\-–*]/.test(lastLine) && !/[.!?:;)"”’]$/.test(lastLine)
  })
}

/** Description and requirements, taken only from the topic's own verbatim text. */
function finishTopic(topic: GuideTopic, heading: string | null): GuideTopic {
  // Drop the heading when present; everything else is a verbatim excerpt.
  const at = heading ? topic.content.indexOf(heading) : -1
  const body = (at >= 0 ? topic.content.slice(at + heading!.length) : topic.content).replace(/\s+/g, " ").trim()
  const excerpt = body.length > 360 ? `${body.slice(0, 357).trimEnd()}…` : body
  topic.description = topic.parent ? `Under “${topic.parent}”. ${excerpt}`.trim() : excerpt
  topic.steps = []
  if (procedureNeedsReview(topic.content)) topic.procedureReview = true
  const explicit = topic.content.match(/\bRequirements:\s*([\s\S]+)/i)?.[1]
  topic.requirements = explicit ? explicit.split(/[??•]/).map(s => s.trim()).filter(Boolean) : []
  return topic
}

/**
 * Fallback segmentation (no AI structure available): chunks grouped by the heading the
 * chunker detected. Same-heading chunks merge, and an unlabelled continuation joins
 * the preceding topic instead of becoming an invented topic.
 */
export function groupSourceSections(sections: SourceSection[]): GuideTopic[] {
  const groups = new Map<string, GuideTopic>()
  let previousKey: string | null = null
  for (const section of [...sections].sort((a, b) => a.chunk_index - b.chunk_index)) {
    if (!section.content.trim()) continue
    const title = section.section_title?.trim() ? cleanTopicTitle(section.section_title) : null
    const key: string | null = title ? topicKey(title) : previousKey
    if (!key) continue
    if (!groups.has(key)) groups.set(key, { key, title: title!, description: "", sections: [], content: "", pages: [], parent: "", steps: [], requirements: [] })
    groups.get(key)!.sections.push(section)
    previousKey = key
  }
  return [...groups.values()].map(topic => {
    topic.content = joinChunks(topic.sections.map(s => s.content))
    topic.pages = sortedPages(topic.sections.map(s => s.page_number))
    return finishTopic(topic, topic.sections[0].section_title?.trim() ?? null)
  })
}

/** One line of extracted source text, numbered for the AI outline (1-based `n`). */
export type SourceLine = { n: number; page: number | null; text: string; segments?: LineSegment[] }

/** Numbers the non-empty lines of each page. Text sources have one page and no page numbers. */
export function sourceLines(pages: string[], paged: boolean, layout: LayoutItem[][] | null = null): SourceLine[] {
  const lines: SourceLine[] = []
  if (layout) {
    // PDF: lines from the positioned text, so table columns can be recovered.
    layout.forEach((items, index) => {
      for (const line of layoutLines(items)) lines.push({ n: lines.length + 1, page: index + 1, text: line.text, segments: line.segments })
    })
    return lines
  }
  pages.forEach((text, index) => {
    for (const line of text.split("\n")) {
      const trimmed = line.replace(/\s+/g, " ").trim()
      if (trimmed) lines.push({ n: lines.length + 1, page: paged ? index + 1 : null, text: trimmed })
    }
  })
  return lines
}

/**
 * One heading of the source, from the AI outline: its line (`startLine`), its verbatim
 * text (`heading`), its title without numbering, and its level — 0 for a document
 * title or cover line, 1 for a main topic, 2 for a subsection, 3+ deeper.
 */
export type OutlineEntry = { title: string; level: number; startLine: number; heading: string }

const normalized = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase()

/** A topic up to this size stays one section with its subsections; larger topics split. */
const MAX_SECTION_CHARS = 4000
/** A large topic only splits when its subsections average at least this much text. */
const MIN_SPLIT_CHARS = 500
/** A heading with this much text of its own before its first subsection keeps it as its own section. */
const OWN_TEXT_CHARS = 400

/**
 * Builds topics from the AI heading outline by slicing the source text at each heading,
 * so every section's content is the source's own contiguous text: nothing is invented,
 * reworded, reordered or moved under a different heading.
 * - A heading must be on its line (searched within two lines of the given line);
 *   otherwise it is ignored and its text stays with the section before it.
 * - A title the source does not contain falls back to the source heading.
 * - Each main topic is one section with its subsections ("Admission Requirements" with
 *   "Foreign Students"; "Core Values" with each value). Only a topic larger than
 *   MAX_SECTION_CHARS, with substantial subsections, splits into them; they keep it
 *   as their parent. Short items (timeline years, values) never become sections.
 * - Document titles (level 0) open the section after them.
 */
export function topicsFromOutline(lines: SourceLine[], entries: OutlineEntry[], chunks: SourceSection[], tables: ProposedTable[] = []): GuideTopic[] {
  type Start = { entry: OutlineEntry; line: number; offset: number }
  const starts: Start[] = []
  for (const entry of [...entries].sort((a, b) => a.startLine - b.startLine)) {
    const heading = normalized(entry.heading)
    if (!heading) continue
    const previous = starts.at(-1)
    const found = [0, 1, -1, 2, -2]
      .map(delta => entry.startLine - 1 + delta)
      .map(line => ({ line, offset: lines[line] ? normalized(lines[line].text).indexOf(heading) : -1 }))
      .find(at => at.offset >= 0 && (!previous || at.line > previous.line || (at.line === previous.line && at.offset > previous.offset)))
    if (found) starts.push({ entry, ...found })
  }
  if (!starts.length) return []

  // Tables that are provably faithful replace their source lines (0-based line → table);
  // the others keep the source text and flag the section for review.
  const verified = new Map<number, { end: number; markdown: string | null }>()
  for (const table of [...tables].sort((a, b) => a.startLine - b.startLine)) {
    const start = table.startLine - 1
    const end = table.endLine - 1
    const overlaps = [...verified].some(([s, t]) => start <= t.end && end >= s)
    if (start < 0 || end < start || end >= lines.length || overlaps) continue
    // A table never spans a heading: it must sit inside one section.
    if (starts.some(st => st.line > start && st.line <= end)) continue
    verified.set(start, { end, markdown: verifyTable(lines, table) })
  }

  // 1. The source text between consecutive headings.
  type Slice = { title: string; level: number; content: string; pages: number[]; review: boolean }
  let slices: Slice[] = []
  starts.forEach((start, i) => {
    const next = starts[i + 1]
    // Text before the first heading (a document title) opens the first slice.
    const from = i === 0 ? { line: 0, offset: 0 } : start
    const to = next ? { line: next.line, offset: next.offset } : { line: lines.length, offset: 0 }
    const parts: string[] = []
    const pages: (number | null)[] = []
    let review = false
    for (let l = from.line; l <= Math.min(to.line, lines.length - 1); l++) {
      const table = verified.get(l)
      if (table && (l > from.line || from.offset === 0) && table.end < to.line) {
        if (table.markdown) {
          parts.push(table.markdown)
          for (let t = l; t <= table.end; t++) pages.push(lines[t].page)
          l = table.end
          continue
        }
        review = true
      }
      // sourceLines already collapsed whitespace, so offsets in normalized() text match.
      const text = lines[l].text
      const part = text.slice(l === from.line ? from.offset : 0, l === to.line ? to.offset : text.length).trim()
      if (part) { parts.push(part); pages.push(lines[l].page) }
    }
    const content = parts.join("\n")
    if (!content) return
    const proposed = cleanTopicTitle(start.entry.title)
    // The title must be text the source contains; otherwise use the source heading.
    const title = proposed && normalized(content).includes(normalized(proposed)) ? proposed : cleanTopicTitle(start.entry.heading)
    slices.push({ title, level: Math.max(0, Math.round(start.entry.level)), content, pages: sortedPages(pages), review })
  })
  const join = (a: Slice, b: Slice): Slice => ({ ...b, content: `${a.content}\n${b.content}`, pages: sortedPages([...a.pages, ...b.pages]), review: a.review || b.review })
  // 2. Document titles open the section after them.
  for (let i = slices.length - 2; i >= 0; i--) {
    if (slices[i].level === 0) slices.splice(i, 2, join(slices[i], slices[i + 1]))
  }
  slices = slices.filter(s => topicKey(s.title))
  if (!slices.length) return []

  // 3. Sections: each main topic with its subsections, split only when too large.
  type Section = { title: string; parent: string; content: string; pages: number[]; review: boolean }
  const sections: Section[] = []
  const size = (group: Slice[]) => group.reduce((sum, s) => sum + s.content.length, 0)
  const groupsOf = (items: Slice[]) => {
    const level = Math.min(...items.map(s => s.level))
    const groups: Slice[][] = []
    for (const slice of items) {
      if (slice.level <= level || !groups.length) groups.push([slice])
      else groups.at(-1)!.push(slice)
    }
    return groups
  }
  const build = ([head, ...rest]: Slice[], parent: string) => {
    const children = rest.length ? groupsOf(rest) : []
    // Keep the topic whole when it is small, or when its subsections are only short items
    // (years of a timeline, values, list entries) that should not each become a section.
    if (!children.length || size([head, ...rest]) <= MAX_SECTION_CHARS || size(rest) / children.length < MIN_SPLIT_CHARS) {
      const all = [head, ...rest]
      sections.push({ title: head.title, parent, content: all.map(s => s.content).join("\n"), pages: sortedPages(all.flatMap(s => s.pages)), review: all.some(s => s.review) })
      return
    }
    const own = head.content.length - (normalized(head.content).indexOf(normalized(head.title)) + head.title.length)
    // A heading with real text of its own stays a section; a bare heading opens its first subsection.
    if (own >= OWN_TEXT_CHARS) sections.push({ title: head.title, parent, content: head.content, pages: head.pages, review: head.review })
    else children[0][0] = join(head, children[0][0])
    for (const child of children) build(child, head.title)
  }
  for (const group of groupsOf(slices)) build(group, "")

  // 4. A heading repeated later in the source continues its topic.
  const groups = new Map<string, GuideTopic>()
  const headings = new Map<string, string>()
  for (const section of sections) {
    const key = topicKey(section.title)
    const existing = groups.get(key)
    if (existing) {
      existing.content = `${existing.content}\n\n${section.content}`
      existing.pages = sortedPages([...existing.pages, ...section.pages])
      existing.tableReview = existing.tableReview || section.review
      continue
    }
    groups.set(key, { key, title: section.title, description: "", content: section.content, pages: section.pages, parent: section.parent, sections: [], steps: [], requirements: [], ...(section.review && { tableReview: true }) })
    headings.set(key, section.content.split("\n")[0])
  }
  return [...groups.values()].map(topic => {
    // Retrieval chunks on the topic's pages (all chunks for a text source).
    topic.sections = chunks.filter(c => (topic.pages.length ? c.page_number !== null && topic.pages.includes(c.page_number) : c.page_number === null))
    return finishTopic(topic, headings.get(topic.key) ?? null)
  })
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
