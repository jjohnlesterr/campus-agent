// Simple, consistent source labels for citations, e.g. "Student Handbook — Page 42".
export function formatSourceLabel(source: { documentTitle: string; pageNumber: number | null }) {
  return source.pageNumber ? `${source.documentTitle} — Page ${source.pageNumber}` : source.documentTitle
}
