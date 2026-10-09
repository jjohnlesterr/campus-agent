"use client"

import { cn } from "cn"
import { ChevronRight, Loader2, Megaphone } from "lucide-react"
import Link from "next/link"
import { useRef, useState, useTransition } from "react"

import { loadAnnouncementPage } from "@/app/app/(shell)/announcements/actions"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import type { AnnouncementCard } from "@/lib/campus/published-announcements"

type Filter = { value: string; label: string }

/**
 * The user announcement feed: 10 cards at a time with "Load more". Changing the category
 * fetches its first batch in place (no navigation); the address bar follows along. Requests
 * that finish after a newer filter change are ignored, so lists never mix or duplicate.
 */
export function AnnouncementFeed({ filters, initial }: {
  filters: Filter[]
  initial: { scope: string; items: AnnouncementCard[]; hasMore: boolean }
}) {
  const [scope, setScope] = useState(initial.scope)
  const [items, setItems] = useState(initial.items)
  const [hasMore, setHasMore] = useState(initial.hasMore)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState<"filter" | "more" | null>(null)
  const request = useRef(0)

  function load(nextScope: string, offset: number) {
    const id = ++request.current
    setError(null)
    setLoading(offset === 0 ? "filter" : "more")
    startTransition(async () => {
      try {
        const page = await loadAnnouncementPage({ scope: nextScope, offset })
        if (id !== request.current) return // a newer request replaced this one
        if (!page.ok) return setError(page.error)
        setItems((current) => {
          if (offset === 0) return page.items
          const seen = new Set(current.map((a) => a.id))
          return [...current, ...page.items.filter((a) => !seen.has(a.id))]
        })
        setHasMore(page.hasMore)
      } catch {
        if (id === request.current) setError("Announcements could not be loaded right now. Please try again.")
      } finally {
        if (id === request.current) setLoading(null)
      }
    })
  }

  function choose(value: string) {
    if (value === scope) return
    setScope(value)
    window.history.replaceState(null, "", value === "all" ? window.location.pathname : `${window.location.pathname}?scope=${encodeURIComponent(value)}`)
    load(value, 0)
  }

  const filtering = pending && loading === "filter"

  return (
    <>
      <nav aria-label="Filter announcements" className="mt-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => choose(f.value)}
            aria-pressed={scope === f.value}
            className={cn(
              "shrink-0 cursor-pointer rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              scope === f.value ? "border-primary/30 bg-accent font-medium text-accent-foreground" : "bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <div aria-live="polite" aria-busy={filtering} className={cn("transition-opacity", filtering && "opacity-60")}>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {items.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/announcements/${a.id}`}
                  className="group flex flex-col overflow-hidden rounded-lg border bg-background transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row"
                >
                  {a.imageUrl && (
                    // A thumbnail with the admin's crop; the full image is on the detail page.
                    <span className="relative aspect-video w-full shrink-0 bg-muted sm:w-56">
                      {/* eslint-disable-next-line @next/next/no-img-element -- public storage URL */}
                      <img src={a.imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" style={{ objectPosition: a.imagePosition }} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      <time dateTime={a.publishAt}>{a.dateLabel}</time>
                      {a.source && <> · {a.source}</>}
                    </span>
                    <span className="mt-1 font-semibold leading-snug group-hover:text-primary">{a.title}</span>
                    <span className="mt-1.5 w-fit rounded-md border px-1.5 py-px text-xs font-medium text-muted-foreground">{a.category}</span>
                    <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{a.preview}</span>
                    <span className="mt-3 inline-flex items-center gap-0.5 text-sm font-medium text-primary">
                      Read more <ChevronRight className="size-4" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : !filtering && !error ? (
          <div className="mt-5">
            <EmptyState
              icon={Megaphone}
              title={scope === "all" ? "No announcements right now." : "No announcements here right now."}
              description={scope === "all" ? "New university announcements will appear here when they are published." : "Choose All to see every current announcement."}
            />
          </div>
        ) : null}

        {items.length > 0 && (
          <div className="mt-5 flex justify-center">
            {hasMore ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => load(scope, items.length)}>
                {pending && loading === "more" && <Loader2 className="animate-spin" aria-hidden="true" />}
                {pending && loading === "more" ? "Loading…" : "Load more"}
              </Button>
            ) : (
              items.length > 10 && <p className="text-xs text-muted-foreground">You&apos;ve reached the end.</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
