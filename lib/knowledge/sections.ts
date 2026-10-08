// Source details page: a source's knowledge sections (guidelines rows) listed in page
// order as numbered, readable sections. Pure helpers shared by the page, the inline
// section editor and tests.

import { pageLabel, readGuideReference } from "@/lib/knowledge/topics"

export type SectionStatus = "draft" | "published" | "archived"

export type SourceSection = {
  id: string
  title: string
  /** The text Campus Agent answers from once the section is Published. */
  content: string
  status: SectionStatus
  pages: number[]
  pageLabel: string
  /** Position of the topic in the source PDF (1 = first); null for admin-added sections. */
  sourceOrder: number | null
  /** Position in the admin's section list (drag and drop); null before it is set. */
  sortOrder: number | null
  steps: { title: string; description: string | null }[]
  requirements: string[]
  /** Analysis kept a table as source text: the admin should check it against the PDF. */
  tableReview: boolean
  updatedAt: string
  createdAt: string
}

export type SectionRecord = {
  id: string
  title: string
  content: string | null
  description: string | null
  status: SectionStatus
  source_reference: string | null
  source_order: number | null
  sort_order: number | null
  requirements: string[]
  created_at: string
  updated_at: string
  guideline_steps: { step_number: number; title: string; description: string | null }[]
}

/**
 * Section rows in the admin's order (sort_order, set by drag and drop). Rows without one
 * fall back to the source PDF's order (source_order), then first cited page, then age.
 */
export function toSourceSections(records: SectionRecord[]): SourceSection[] {
  return records
    .map((s): SourceSection => {
      const reference = readGuideReference(s.source_reference)
      const pages = reference?.pages ?? []
      return {
        id: s.id,
        title: s.title,
        // Older sections may only have a description.
        content: s.content?.trim() || s.description?.trim() || "",
        status: s.status,
        pages,
        pageLabel: pageLabel(pages),
        sourceOrder: s.source_order,
        sortOrder: s.sort_order,
        steps: [...s.guideline_steps].sort((a, b) => a.step_number - b.step_number).map(({ title, description }) => ({ title, description })),
        requirements: s.requirements,
        tableReview: reference?.tableReview === true,
        updatedAt: s.updated_at,
        createdAt: s.created_at,
      }
    })
    .sort((a, b) =>
      (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) ||
      (a.sourceOrder ?? Infinity) - (b.sourceOrder ?? Infinity) ||
      (a.pages[0] ?? Infinity) - (b.pages[0] ?? Infinity) ||
      a.createdAt.localeCompare(b.createdAt))
}

/** "4, 5" for the page field of the section editor. */
export function formatPageList(pages: number[]) {
  return [...new Set(pages)].sort((a, b) => a - b).join(", ")
}

/**
 * Parses the section editor's page field: "4, 5", "4-6" or "4 – 6". Returns sorted unique
 * pages, or null when the text has anything else (so typos are not silently dropped).
 */
export function parsePageList(text: string): number[] | null {
  const pages = new Set<number>()
  const parts = text.replace(/\s*[-–—]\s*/g, "-").split(/[,;\s]+/).filter(Boolean)
  for (const part of parts) {
    const range = part.match(/^(\d{1,4})-(\d{1,4})$/)
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])]
      if (from < 1 || to < from || to - from > 200) return null
      for (let page = from; page <= to; page++) pages.add(page)
    } else if (/^\d{1,4}$/.test(part) && Number(part) > 0) {
      pages.add(Number(part))
    } else {
      return null
    }
  }
  return [...pages].sort((a, b) => a - b)
}
