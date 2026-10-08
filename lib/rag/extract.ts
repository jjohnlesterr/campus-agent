import { extractTextItems } from "unpdf"

export class NoSelectableTextError extends Error {
  constructor() {
    super(
      "No selectable text was found in this PDF. It may be a scanned document — scanned PDFs (OCR) aren't supported yet. Upload a PDF with selectable text."
    )
    this.name = "NoSelectableTextError"
  }
}

// Minimum extracted characters per page, on average, to treat a PDF as text-based.
const MIN_CHARS_PER_PAGE = 40

/** A positioned piece of PDF text (PDF units: x from the left, y from the bottom). */
export type LayoutItem = { str: string; x: number; y: number; width: number; hasEOL: boolean }

/** True when the bytes start with the PDF signature "%PDF-". */
export function looksLikePdf(bytes: Uint8Array) {
  return bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-"
}

/**
 * Text of each page (index 0 = page 1) and its positioned text items, which let table
 * columns be recovered. Throws NoSelectableTextError for scanned PDFs.
 */
export async function extractPdfLayout(bytes: Uint8Array): Promise<{ texts: string[]; items: LayoutItem[][] }> {
  const { totalPages, items: pages } = await extractTextItems(bytes)
  const items = pages.map((page) => page.map(({ str, x, y, width, hasEOL }) => ({ str, x, y, width, hasEOL })))
  // Same text as unpdf's extractText: items in order, a line break after each end of line.
  const texts = items.map((page) => page.map((item) => item.str + (item.hasEOL ? "\n" : "")).join(""))
  const chars = texts.reduce((sum, page) => sum + page.replace(/\s/g, "").length, 0)
  if (totalPages === 0 || chars / totalPages < MIN_CHARS_PER_PAGE) throw new NoSelectableTextError()
  return { texts, items }
}

/** Text of each page (index 0 = page 1). Throws NoSelectableTextError for scanned PDFs. */
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  return (await extractPdfLayout(bytes)).texts
}
