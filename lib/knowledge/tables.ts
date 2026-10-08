// Tables in Knowledge Library sources.
//
// PDF text extraction flattens tables ("Print-out of Grades Clearance / Official
// Receipt ₱35.00 1"). The positioned text items still say which column each word is in,
// so analysis can rebuild a table — but only when the result is provably faithful:
// verifyTable() accepts a proposed table only if every column holds exactly the words
// printed at that column's position, top to bottom, and each row's cells start on the
// same line. Anything uncertain stays as the source text and is flagged for review.
// Accepted tables are stored as Markdown tables inside the section text.

import type { LayoutItem } from "@/lib/rag/extract"

/** Words printed together at one position on a line (a table cell's line, or a paragraph line). */
export type LineSegment = { x: number; y: number; text: string; items: LayoutItem[] }

/** Horizontal gap (PDF units) that separates two segments of a line, such as table columns. */
const SEGMENT_GAP = 6
/** Column positions may differ by this much (PDF units). */
const X_TOLERANCE = 3
/** Cells of one row must start within this vertical distance (PDF units). */
const ROW_TOLERANCE = 3

const collapse = (text: string) => text.replace(/\s+/g, " ").trim()
/** Comparison form: whitespace never matters, and compatible characters compare equal. */
const compact = (text: string) => text.normalize("NFKC").replace(/\s+/g, "")

/** The non-empty lines of a PDF page, split where the PDF ends a line, with their segments. */
export function layoutLines(items: LayoutItem[]): { text: string; segments: LineSegment[] }[] {
  const lines: { text: string; segments: LineSegment[] }[] = []
  let current: LayoutItem[] = []
  const flush = () => {
    const text = collapse(current.map((i) => i.str).join(""))
    if (text) {
      const segments: LineSegment[] = []
      for (const item of current) {
        if (!item.str.trim()) continue
        const last = segments.at(-1)
        const lastItem = last?.items.at(-1)
        const joins = last && lastItem && item.x >= lastItem.x && item.x - (lastItem.x + lastItem.width) <= SEGMENT_GAP && Math.abs(item.y - lastItem.y) <= ROW_TOLERANCE
        if (joins) {
          last.items.push(item)
          last.text = collapse(last.items.map((i) => i.str).join(""))
        } else {
          segments.push({ x: item.x, y: item.y, text: collapse(item.str), items: [item] })
        }
      }
      lines.push({ text, segments })
    }
    current = []
  }
  for (const item of items) {
    current.push(item)
    if (item.hasEOL) flush()
  }
  flush()
  return lines
}

/** A table proposed by the AI outline: source lines `startLine`–`endLine`, header row first. */
export type ProposedTable = { startLine: number; endLine: number; rows: string[][]; confident: boolean }

/**
 * Checks a proposed table against the positioned source text. Returns the Markdown table
 * when every cell is exactly the source text at its column and row, otherwise null.
 */
export function verifyTable(lines: { page: number | null; segments?: LineSegment[] }[], table: ProposedTable): string | null {
  const { rows } = table
  const width = rows[0]?.length ?? 0
  if (!table.confident || rows.length < 2 || width < 2 || rows.some((row) => row.length !== width)) return null
  const region = lines.slice(table.startLine - 1, table.endLine)
  if (!region.length || region.length !== table.endLine - table.startLine + 1 || region.some((line) => !line.segments?.length)) return null

  // Columns start where the header row's segments start.
  const anchors = region[0].segments!.map((s) => s.x).sort((a, b) => a - b)
  if (anchors.length !== width) return null
  // Items in reading position: page first (a table can continue on the next page), then
  // top to bottom, then left to right.
  type Placed = { item: LayoutItem; page: number }
  const columns: Placed[][] = anchors.map(() => [])
  for (const line of region) {
    for (const item of line.segments!.flatMap((s) => s.items)) {
      if (!item.str.trim()) continue
      const column = anchors.findLastIndex((x) => x <= item.x + X_TOLERANCE)
      if (column < 0) return null
      columns[column].push({ item, page: line.page ?? 0 })
    }
  }
  const before = (a: Placed, b: Placed) => a.page - b.page || b.item.y - a.item.y || a.item.x - b.item.x

  // Each column, read top to bottom, must be exactly its cells in row order, and every
  // cell must start and end at a piece of source text (never inside one).
  const rowTops: Placed[][] = rows.map(() => [])
  for (const [column, items] of columns.entries()) {
    items.sort(before)
    let next = 0
    for (const [row, cells] of rows.entries()) {
      const cell = compact(cells[column])
      let text = ""
      const first = items[next]
      while (text.length < cell.length && next < items.length) text += compact(items[next++].item.str)
      if (text !== cell) return null
      if (cell) rowTops[row].push(first)
    }
    if (next !== items.length) return null // source text left over: a dropped value
  }
  // Each row's cells start on the same line of the same page, and rows run down the table.
  let previous: Placed | null = null
  for (const tops of rowTops) {
    if (!tops.length) return null
    const ys = tops.map((t) => t.item.y)
    if (tops.some((t) => t.page !== tops[0].page) || Math.max(...ys) - Math.min(...ys) > ROW_TOLERANCE) return null
    const top = [...tops].sort(before)[0]
    if (previous && before(previous, top) >= 0) return null
    previous = top
  }
  return toMarkdownTable(rows)
}

const markdownCell = (text: string) => collapse(text).replace(/\\/g, "\\\\").replace(/\|/g, "\\|")

export function toMarkdownTable(rows: string[][]) {
  const [header, ...body] = rows
  return [
    `| ${header.map(markdownCell).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n")
}

/** A block of section text: a paragraph run, or a Markdown table (header and rows). */
export type TextBlock = { kind: "text"; text: string } | { kind: "table"; header: string[]; rows: string[][] }

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line)
const isDivider = (line: string) => /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line)
function tableCells(line: string) {
  const cells: string[] = []
  let cell = ""
  const inner = line.trim().slice(1, -1)
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && (inner[i + 1] === "|" || inner[i + 1] === "\\")) cell += inner[++i]
    else if (inner[i] === "|") { cells.push(cell.trim()); cell = "" }
    else cell += inner[i]
  }
  cells.push(cell.trim())
  return cells
}

/** Splits section text into paragraphs and Markdown tables, for rendering. */
export function textBlocks(text: string): TextBlock[] {
  const lines = text.split("\n")
  const blocks: TextBlock[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.join("").trim()) blocks.push({ kind: "text", text: paragraph.join("\n").trim() })
    paragraph = []
  }
  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i]) && isDivider(lines[i + 1] ?? "")) {
      const header = tableCells(lines[i])
      const rows: string[][] = []
      let j = i + 2
      for (; j < lines.length && isTableLine(lines[j]); j++) rows.push(tableCells(lines[j]))
      flush()
      blocks.push({ kind: "table", header, rows })
      i = j - 1
    } else {
      paragraph.push(lines[i])
    }
  }
  flush()
  return blocks
}
