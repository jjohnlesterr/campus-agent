import { cn } from "cn"

import { textBlocks } from "@/lib/knowledge/tables"

/**
 * Knowledge section text: source paragraphs keep their line breaks, and Markdown tables
 * (rebuilt from source PDFs) render as real tables. Wide tables scroll sideways on small
 * screens instead of squeezing their columns.
 */
export function SourceText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 break-words", className)}>
      {textBlocks(text).map((block, i) =>
        block.kind === "text" ? (
          <p key={i} className="whitespace-pre-line">{block.text}</p>
        ) : (
          <div key={i} className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label={`Table: ${block.header.join(", ")}`}>
            <table className="w-full min-w-max border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  {block.header.map((cell, c) => (
                    <th key={c} scope="col" className="min-w-28 max-w-72 bg-muted/50 px-3 py-2 align-bottom font-medium whitespace-normal text-foreground">{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-b last:border-b-0">
                    {block.header.map((_, c) => (
                      <td key={c} className="min-w-28 max-w-72 px-3 py-2 align-top whitespace-normal">{row[c] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
