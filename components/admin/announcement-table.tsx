"use client"

import { cn } from "cn"
import { Archive, ExternalLink, FilePen, ImageIcon, ListChecks, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { bulkUpdateAnnouncements, reorderAnnouncements } from "@/app/admin/announcements/actions"
import { type ImagePosition, objectPosition } from "@/components/admin/image-crop"
import { SortableCardGrid } from "@/components/admin/sortable-card-grid"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { BulkAnnouncementAction } from "@/lib/announcements"

export type AnnouncementRow = {
  id: string
  title: string
  status: string
  /** Short plain-text preview of the content. */
  preview: string
  /** Published date as ISO, and as displayed. */
  date: string
  dateLabel: string
  source: string | null
  sourceUrl: string | null
  imageUrl: string | null
  imagePosition: ImagePosition
  /** "University-wide" or a department code. */
  scope: string
}

const plural = (n: number) => `${n} ${n === 1 ? "announcement" : "announcements"}`
const DONE: Record<BulkAnnouncementAction, string> = { publish: "published", draft: "moved to Draft", archive: "archived", delete: "deleted" }

/**
 * Admin announcements list: the status tabs, sort/search controls and compact media rows
 * (thumbnail, title, preview, date and source, status and actions), with an optional
 * selection mode (Select → checkboxes + bulk actions; Cancel → back to the plain list).
 * `filterKey` identifies the current tab/sort/search: a selection made under one filter
 * never applies under another, so hidden rows can't be acted on.
 *
 * With `reorderable` (Manual order, no search), rows can be pressed, held and dragged into
 * a new order. `allIds` is every announcement in its saved manual order: the visible rows
 * (one status tab) take the positions they already held in it, so other rows never move.
 */
export function AnnouncementTable({ rows, allIds, reorderable, orderNote, tabs, controls, filterKey, empty }: {
  rows: AnnouncementRow[]
  allIds: string[]
  reorderable: boolean
  /** Short note about reordering under the toolbar (how to drag, or why it is off). */
  orderNote: string | null
  tabs: React.ReactNode
  controls: React.ReactNode
  filterKey: string
  /** Shown instead of the list when there are no rows (empty state or load error). */
  empty: React.ReactNode
}) {
  const router = useRouter()
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: filterKey, ids: new Set() })
  // Rows waiting for the delete confirmation: the selection, or one row from its menu.
  const [deleting, setDeleting] = useState<string[] | null>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "status" | "alert"; text: string } | null>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Only rows that are visible under the current filter count as selected.
  const selected = selection.key === filterKey ? selection.ids : new Set<string>()
  const selectedIds = rows.filter((r) => selected.has(r.id)).map((r) => r.id)
  const count = selectedIds.length
  const allSelected = rows.length > 0 && count === rows.length

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = count > 0 && !allSelected
  }, [count, allSelected, selecting])

  const select = (ids: Iterable<string>) => setSelection({ key: filterKey, ids: new Set(ids) })

  function toggle(id: string, on: boolean) {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    select(next)
  }

  function exitSelection() {
    setSelecting(false)
    select([])
  }

  function saveOrder(next: string[]) {
    const shown = new Set(next)
    const queue = [...next]
    return reorderAnnouncements(allIds.map((id) => (shown.has(id) ? queue.shift()! : id)))
  }

  const rowFor = (a: AnnouncementRow) => (
    <AnnouncementListRow
      row={a}
      draggable={reorderable && !selecting}
      selecting={selecting}
      selected={selecting && selected.has(a.id)}
      disabled={pending}
      onSelect={(on) => toggle(a.id, on)}
      onAction={(action) => (action === "delete" ? setDeleting([a.id]) : run(action, [a.id]))}
    />
  )

  function run(action: BulkAnnouncementAction, ids: string[]) {
    if (!ids.length) return
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await bulkUpdateAnnouncements(ids, action)
        if (!result.ok) return setMessage({ tone: "alert", text: result.error })
        setDeleting(null)
        exitSelection()
        setMessage({ tone: "status", text: `${plural(result.changed)} ${DONE[action]}.` })
        router.refresh()
      } catch {
        setMessage({ tone: "alert", text: "The request could not be completed. Refresh the page to check the current state." })
      }
    })
  }

  return (
    <>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {tabs}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          {controls}
          {rows.length > 0 && (
            <Button
              variant="outline"
              className="h-9 shrink-0"
              aria-pressed={selecting}
              disabled={pending}
              onClick={() => {
                setMessage(null)
                if (selecting) exitSelection()
                else setSelecting(true)
              }}
            >
              {!selecting && <ListChecks aria-hidden="true" />}
              {selecting ? "Cancel" : "Select"}
            </Button>
          )}
        </div>
      </div>

      {orderNote && rows.length > 1 && <p className="mt-3 text-xs text-muted-foreground">{orderNote}</p>}

      {message && !selecting && deleting === null && (
        <p role={message.tone} className={message.tone === "alert" ? "mt-3 text-sm text-destructive" : "mt-3 text-sm text-muted-foreground"}>{message.text}</p>
      )}

      <div className="mt-4">
        {rows.length === 0 ? (
          <div className="overflow-hidden rounded-lg border bg-background">{empty}</div>
        ) : (
          <>
            {selecting && (
              <div className="mb-2.5 flex min-h-12 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2" aria-live="polite">
                <label className="mr-1 flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    disabled={pending}
                    onChange={(e) => select(e.target.checked ? rows.map((r) => r.id) : [])}
                    aria-label="Select all visible announcements"
                    className="size-4 cursor-pointer accent-primary"
                  />
                  {count ? `${count} selected` : "Select announcements"}
                </label>
                <Button size="sm" variant="outline" disabled={pending || !count} onClick={() => run("publish", selectedIds)}>
                  <Send aria-hidden="true" />
                  Publish
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !count} onClick={() => run("draft", selectedIds)}>
                  <FilePen aria-hidden="true" />
                  Move to Draft
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !count} onClick={() => run("archive", selectedIds)}>
                  <Archive aria-hidden="true" />
                  Archive
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !count} className="text-destructive hover:text-destructive" onClick={() => setDeleting(selectedIds)}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
                {message?.tone === "alert" && deleting === null && <p role="alert" className="w-full text-sm text-destructive">{message.text}</p>}
              </div>
            )}

            {reorderable && !selecting ? (
              <SortableCardGrid
                id="announcement-order"
                variant="list"
                noun="announcement"
                label="Announcements"
                onSave={saveOrder}
                cards={rows.map((a) => ({ id: a.id, title: a.title, sortable: true, node: rowFor(a) }))}
              />
            ) : (
              <ul aria-label="Announcements" className="flex flex-col gap-2.5">
                {rows.map((a) => <li key={a.id} className="flex">{rowFor(a)}</li>)}
              </ul>
            )}
          </>
        )}
      </div>

      <Dialog open={deleting !== null} onOpenChange={(next) => { if (!pending && !next) { setDeleting(null); setMessage(null) } }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete {plural(deleting?.length ?? 0)}?</DialogTitle>
            <DialogDescription>
              {deleting?.length === 1 ? `“${rows.find((r) => r.id === deleting[0])?.title ?? "This announcement"}” and its image will be deleted. ` : "They and their images will be deleted. "}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {message?.tone === "alert" && <p role="alert" className="text-sm text-destructive">{message.text}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => { setDeleting(null); setMessage(null) }}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending || !deleting?.length} onClick={() => deleting && run("delete", deleting)}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * One announcement: thumbnail, title, preview and metadata (opens the editor), then status
 * and actions. Edit, View original, the menu and the checkbox never start a drag.
 */
function AnnouncementListRow({ row: a, draggable, selecting, selected, disabled, onSelect, onAction }: {
  row: AnnouncementRow
  /** Press-and-hold drag is on: the row's non-interactive areas show a grab cursor. */
  draggable: boolean
  selecting: boolean
  selected: boolean
  disabled: boolean
  onSelect: (on: boolean) => void
  onAction: (action: BulkAnnouncementAction) => void
}) {
  const href = `/admin/announcements/${a.id}`
  return (
    <div className={cn(
      "flex w-full flex-col gap-3 rounded-lg border bg-background px-4 py-3 transition-colors sm:flex-row sm:items-center sm:gap-4",
      selected ? "border-primary/30 bg-accent/40" : "hover:border-foreground/20 hover:bg-muted/20",
      draggable && "cursor-grab active:cursor-grabbing"
    )}>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {selecting && (
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select ${a.title}`}
            className="size-4 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <Link href={href} className="group flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4">
          {/* Fixed thumbnail with the saved crop position; the image never changes the row height. */}
          <span className="relative flex h-[72px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted" aria-hidden="true">
            {a.imageUrl
              // eslint-disable-next-line @next/next/no-img-element -- public storage URL
              ? <img src={a.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" style={{ objectPosition: objectPosition(a.imagePosition) }} />
              : <ImageIcon className="size-5 text-muted-foreground/50" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="line-clamp-1 font-medium group-hover:text-primary">{a.title}</span>
            {a.preview && <span className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1">{a.preview}</span>}
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <time dateTime={a.date} className="shrink-0 tabular-nums">{a.dateLabel}</time>
              {a.source && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="truncate">{a.source}</span>
                </>
              )}
            </span>
          </span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border px-1.5 py-px text-xs font-medium text-muted-foreground">{a.scope}</span>
          <StatusBadge status={a.status} />
        </span>
        <div className="flex items-center gap-0.5">
          {/* Opens the admin-entered link only; nothing is fetched from it. */}
          {a.sourceUrl && (
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" data-no-drag className={buttonVariants({ variant: "ghost", size: "sm" })} title="View original post">
              <ExternalLink aria-hidden="true" />
              View original
              <span className="sr-only"> post for {a.title} (opens in a new tab)</span>
            </a>
          )}
          <Link href={href} data-no-drag className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <Pencil aria-hidden="true" />
            Edit<span className="sr-only"> {a.title}</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`More actions for ${a.title}`} />}>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              {a.status === "published" ? (
                <DropdownMenuItem onClick={() => onAction("draft")}>
                  <FilePen aria-hidden="true" />
                  Move to Draft
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onAction("publish")}>
                  <Send aria-hidden="true" />
                  Publish
                </DropdownMenuItem>
              )}
              {a.status !== "archived" && (
                <DropdownMenuItem onClick={() => onAction("archive")}>
                  <Archive aria-hidden="true" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onAction("delete")}>
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
