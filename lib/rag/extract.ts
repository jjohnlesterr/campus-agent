import { extractText, getDocumentProxy } from "unpdf"

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

/** True when the bytes start with the PDF signature "%PDF-". */
export function looksLikePdf(bytes: Uint8Array) {
  return bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-"
}

/** Text of each page (index 0 = page 1). Throws NoSelectableTextError for scanned PDFs. */
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes)
  const { totalPages, text } = await extractText(pdf, { mergePages: false })
  const chars = text.reduce((sum, page) => sum + page.replace(/\s/g, "").length, 0)
  if (totalPages === 0 || chars / totalPages < MIN_CHARS_PER_PAGE) throw new NoSelectableTextError()
  return text
}
