import { ArrowRight, FileText, ImageIcon, NotebookPen } from "lucide-react"
import Link from "next/link"

import { describeStatus } from "@/app/admin/documents/document-stats"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/datetime"
import type { LibraryItem } from "@/lib/knowledge/library"
import { sourceTypeLabel } from "@/lib/sources"
import type { SourceType } from "@/lib/sources"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** One Knowledge Library card: a source file or a manual entry. The whole card opens it. */
export function LibraryCard({ item, timezone, thumbnailUrl }: { item: LibraryItem; timezone: string; thumbnailUrl?: string }) {
  const href = item.kind === "source" ? `/admin/documents/${item.id}` : `/admin/knowledge/${item.id}`
  const isPdf = item.kind === "source" && item.mimeType === "application/pdf"
  const status = item.kind === "source" ? describeStatus(item.status) : { tone: item.status, label: undefined }

  let meta: string
  let description: string
  if (item.kind === "source") {
    meta = isPdf ? `PDF · ${plural(item.counts.total, "section")}` : `Image · ${sourceTypeLabel(item.documentType as SourceType)}`
    description = item.summary
      ?? (isPdf
        ? item.status === "uploaded" ? "Not analyzed yet. Open it and choose Analyze with AI." : sourceTypeLabel(item.documentType as SourceType)
        : "Reference image for admins and the campus map.")
  } else {
    meta = item.category ? `Manual Entry · ${item.category}` : "Manual Entry"
    description = item.description ?? ""
  }
  const Icon = item.kind === "manual" ? NotebookPen : isPdf ? FileText : ImageIcon

  return (
    <article className="group relative flex w-full min-w-0 flex-col rounded-lg border bg-background p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={thumbnailUrl} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
            <Icon className="size-5" />
          </span>
        )}
        <StatusBadge status={status.tone} label={status.label} />
      </div>
      <h2 className="mt-3 leading-snug font-semibold">
        <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring group-hover:text-primary">
          {item.title}
        </Link>
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
      {description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {item.kind === "source" && isPdf && item.counts.total > 0 && (
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
