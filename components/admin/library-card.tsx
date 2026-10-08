import { ArrowRight, FileText, ImageIcon, NotebookPen, TextQuote } from "lucide-react"
import Link from "next/link"

import { describeStatus } from "@/app/admin/documents/document-stats"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/datetime"
import type { LibraryItem } from "@/lib/knowledge/library"
import { sourceFormat, sourceTypeLabel } from "@/lib/sources"
import type { SourceType } from "@/lib/sources"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * One Knowledge Library card: a document source (PDF/image), a text source or an older
 * manual entry. The whole card opens it;
 * `menu` (e.g. Move to collection) sits above the card link.
 */
export function LibraryCard({ item, timezone, thumbnailUrl, menu }: { item: LibraryItem; timezone: string; thumbnailUrl?: string; menu?: React.ReactNode }) {
  const href = item.kind === "source" ? `/admin/documents/${item.id}` : `/admin/knowledge/${item.id}`
  const format = item.kind === "source" ? sourceFormat(item.mimeType) : null
  // PDFs and text sources are analyzed into sections; images are reference files.
  const analyzable = format === "pdf" || format === "text"
  const status = item.kind === "source" ? describeStatus(item.status) : { tone: item.status, label: undefined }

  let meta: string
  let description: string
  if (item.kind === "source") {
    const typeLabel = sourceTypeLabel(item.documentType as SourceType)
    meta = analyzable
      ? `${format === "pdf" ? "PDF" : "Text"} · ${typeLabel} · ${plural(item.counts.total, "section")}`
      : `Image · ${typeLabel}`
    // The admin's own description first, then the AI overview.
    description = item.description ?? item.summary
      ?? (analyzable
        ? item.status === "uploaded" ? format === "pdf" ? "Not analyzed yet. Open it and choose Analyze with AI." : "Not organized yet. Open it and choose Organize with AI." : typeLabel
        : "Reference image for admins and the campus map.")
  } else {
    meta = item.category ? `Manual Entry · ${item.category}` : "Manual Entry"
    description = item.description ?? ""
  }
  const Icon = item.kind === "manual" ? NotebookPen : format === "pdf" ? FileText : format === "text" ? TextQuote : ImageIcon

  return (
    <article className="group relative flex w-full min-w-0 flex-col rounded-lg border bg-background p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={thumbnailUrl} alt="" draggable={false} className="size-10 shrink-0 rounded-md border object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
            <Icon className="size-5" />
          </span>
        )}
        <div className="flex items-center gap-1">
          <StatusBadge status={status.tone} label={status.label} />
          {menu}
        </div>
      </div>
      <h2 className="mt-3 leading-snug font-semibold">
        <Link href={href} draggable={false} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring group-hover:text-primary">
          {item.title}
        </Link>
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
      {description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {item.kind === "source" && analyzable && item.counts.total > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />{item.counts.published} published</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />{plural(item.counts.draft, "draft")}</span>
          {item.counts.archived > 0 && <span className="text-muted-foreground">{item.counts.archived} archived</span>}
        </p>
      )}
      <div className="flex-1" />
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span>Updated <time dateTime={item.updatedAt}>{formatDate(item.updatedAt, timezone, { month: "short", day: "numeric", year: "numeric" })}</time></span>
        <span className="flex items-center gap-1 font-medium text-primary" aria-hidden="true">Open <ArrowRight className="size-3.5" /></span>
      </div>
    </article>
  )
}
