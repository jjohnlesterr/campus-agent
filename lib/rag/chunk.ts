// Splits handbook pages into retrieval chunks.
//
// - Chunks never cross a page boundary, so every chunk has an exact page number
//   for citations ("Student Handbook — Page 42").
// - Section headings (e.g. "ARTICLE V", "5.3 Incomplete Grades", "B. Registration", short ALL-CAPS
//   lines, Markdown "## Heading" lines in text sources) are detected and carried
//   forward, across pages, as the chunk's section.
// - Text is split on paragraph, then sentence boundaries into ~1,500-character
//   chunks (≈350 tokens) with a small overlap so a rule isn't cut in half.
//   A new section heading starts a new chunk.

export type TextChunk = {
  chunkIndex: number
  pageNumber: number
  sectionTitle: string | null
  content: string
  tokenCount: number
}

const TARGET_CHARS = 1500
const MAX_CHARS = 2000
const OVERLAP_CHARS = 200
const MIN_CHUNK_CHARS = 80
const SECTION_BREAK_MIN_CHARS = 300

const HEADING_PATTERNS = [
  /^(article|chapter|section|part|rule)\s+[\divxlc]+\b.{0,80}$/i, // ARTICLE V, Section 3 …
  /^\d+(\.\d+){0,3}\.?\s+[A-Z][^.!?]{2,80}$/, // 5.3 Incomplete Grades
  /^[A-Z]\.\s+[A-Z][^.!?]{2,80}$/, // B. Guidelines on Registration
  /^#{1,6}\s+\S.{2,80}$/, // ## Incomplete Grades (Markdown, in text sources)
]

// Table rows and values that look like numbered headings: "5.00 Below 75 Failed", "1.25 96–97 Very Good".
const TABLE_ROW = /^\d+\.\d{2}\s/

/** A heading line as a section label: "## Incomplete Grades" → "Incomplete Grades". */
function sectionLabel(line: string) {
  return line.replace(/^#{1,6}\s+/, "").replace(/\s+/g, " ")
}

function isHeading(line: string) {
  const text = line.trim()
  if (text.length < 4 || text.length > 90) return false
  if (/^[●○•▪◦■□\-–*]/.test(text)) return false // bullet items are never headings
  if (TABLE_ROW.test(text)) return false
  if (HEADING_PATTERNS.some((p) => p.test(text))) return true
  // Short ALL-CAPS line with real words, e.g. "ACADEMIC POLICIES"
  const letters = text.replace(/[^A-Za-z]/g, "")
  return letters.length >= 4 && letters === letters.toUpperCase() && !/[.!?]$/.test(text)
}

/** Normalizes PDF text: rejoins hyphenated line breaks, trims, collapses spaces. */
export function cleanPageText(raw: string) {
  return raw
    .replace(/\r/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2") // "regis-\ntration" → "registration"
    .replace(/[ \t\f\v ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Splits text that is too long at sentence boundaries (falling back to words). */
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text]
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text]
  const parts: string[] = []
  let current = ""
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TARGET_CHARS) {
      parts.push(current.trim())
      current = ""
    }
    if (sentence.length > MAX_CHARS) {
      const words = sentence.split(" ")
      for (const word of words) {
        if (current.length + word.length + 1 > TARGET_CHARS) {
          parts.push(current.trim())
          current = ""
        }
        current += `${word} `
      }
    } else {
      current += sentence
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function overlapTail(text: string) {
  if (text.length <= OVERLAP_CHARS) return ""
  const tail = text.slice(-OVERLAP_CHARS)
  const sentenceStart = tail.search(/[.!?]\s+[A-Z]/)
  return (sentenceStart >= 0 ? tail.slice(sentenceStart + 2) : tail.slice(tail.indexOf(" ") + 1)).trim()
}

/** initialSection: the section of text before the first heading (a text source uses its title). */
export function chunkPages(pages: string[], { initialSection = null }: { initialSection?: string | null } = {}): TextChunk[] {
  const chunks: TextChunk[] = []
  let section: string | null = initialSection

  pages.forEach((raw, pageIndex) => {
    const pageNumber = pageIndex + 1
    const text = cleanPageText(raw)
    if (!text) return

    // Group lines into paragraphs; headings start a new paragraph and update the section.
    const blocks: { section: string | null; text: string; startsSection: boolean }[] = []
    let paragraph: string[] = []
    let startsSection = false
    const flush = () => {
      if (paragraph.length) blocks.push({ section, text: paragraph.join(" "), startsSection })
      paragraph = []
      startsSection = false
    }
    for (const line of text.split("\n")) {
      if (!line) {
        flush()
      } else if (isHeading(line)) {
        flush()
        section = sectionLabel(line)
        startsSection = true
        paragraph.push(line)
      } else {
        paragraph.push(line)
      }
    }
    flush()

    // Pack paragraphs into chunks of ~TARGET_CHARS, with overlap between chunks.
    let current = ""
    let currentSection: string | null = null
    const emit = () => {
      const content = current.trim()
      if (!content) return
      const prev = chunks.at(-1)
      if (content.length < MIN_CHUNK_CHARS && prev?.pageNumber === pageNumber) {
        // Too small to stand alone: append to the previous chunk on the same page.
        prev.content = `${prev.content}\n\n${content}`
        prev.tokenCount = Math.ceil(prev.content.length / 4)
        return
      }
      chunks.push({
        chunkIndex: chunks.length,
        pageNumber,
        sectionTitle: currentSection,
        content,
        tokenCount: Math.ceil(content.length / 4),
      })
    }

    for (const block of blocks) {
      // A new section starts a new chunk (no overlap from the previous section).
      // Exception: a short lead-in with no body of its own (a document title or a
      // bare parent heading) joins the new section and takes its label.
      if (block.startsSection && current) {
        const leadInOnly =
          current.length < SECTION_BREAK_MIN_CHARS &&
          (currentSection === null || current.trim() === currentSection)
        if (leadInOnly) {
          currentSection = block.section
        } else {
          emit()
          current = ""
        }
      }
      for (const piece of splitLong(block.text)) {
        if (current && current.length + piece.length + 2 > TARGET_CHARS) {
          emit()
          current = overlapTail(current)
          currentSection = block.section
        }
        if (!current) currentSection = block.section
        current = current ? `${current}\n\n${piece}` : piece
      }
    }
    emit()
  })

  return chunks
}
