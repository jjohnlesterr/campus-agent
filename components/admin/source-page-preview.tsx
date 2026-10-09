"use client"

import { cn } from "cn"
import { ExternalLink } from "lucide-react"
import { useState } from "react"

/** The original PDF opened at a cited page, with buttons to switch between cited pages. */
export function SourcePagePreview({ url, title, fileName, pages }: { url: string; title: string; fileName: string; pages: number[] }) {
  const [page, setPage] = useState(pages[0] ?? 1)
  const src = `${url}#page=${page}&view=FitH`
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm">
          <span className="text-muted-foreground">Original source: </span>
          <span className="font-medium">{fileName} — Page {page}</span>
        </p>
        <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Open in new tab <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
      {pages.length > 1 && (
        <div role="group" aria-label="Cited pages" className="flex flex-wrap gap-1">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === page}
              onClick={() => setPage(p)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                p === page ? "border-primary/40 bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              Page {p}
            </button>
          ))}
        </div>
      )}
      {/* key: browsers ignore hash-only changes to an iframe's src, so remount on page change. */}
      <iframe key={page} src={src} title={`${title}, page ${page}`} className="h-[min(78vh,760px)] w-full rounded-lg border bg-muted" />
    </div>
  )
}
