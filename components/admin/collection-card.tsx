import { ArrowRight, Folder, Inbox } from "lucide-react"
import Link from "next/link"

import { formatDate } from "@/lib/datetime"
import { type CollectionSummary, UNCATEGORIZED, collectionHref } from "@/lib/knowledge/collections"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** One collection on the Knowledge Library root. The whole card opens it. */
export function CollectionCard({ collection, timezone }: { collection: CollectionSummary; timezone: string }) {
  const uncategorized = collection.id === UNCATEGORIZED
  const Icon = uncategorized ? Inbox : Folder
  return (
    <article className="group relative flex w-full min-w-0 flex-col rounded-lg border bg-background p-4 transition-colors hover:border-primary/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-3 leading-snug font-semibold">
        <Link href={collectionHref(collection.id)} className="cursor-pointer outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring group-hover:text-primary">
          {collection.name}
        </Link>
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{plural(collection.sources, "source")}</p>
      {collection.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{collection.description}</p>}
      {collection.sources > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />{plural(collection.published, "published section")}</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />{plural(collection.drafts, "draft")}</span>
          {collection.archived > 0 && <span className="text-muted-foreground">{collection.archived} archived</span>}
        </p>
      )}
      <div className="flex-1" />
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span>Updated <time dateTime={collection.updatedAt}>{formatDate(collection.updatedAt, timezone, { month: "short", day: "numeric", year: "numeric" })}</time></span>
        <span className="flex items-center gap-1 font-medium text-primary" aria-hidden="true">Open <ArrowRight className="size-3.5" /></span>
      </div>
    </article>
  )
}
