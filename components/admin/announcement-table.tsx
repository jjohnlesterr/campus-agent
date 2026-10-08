"use client"

import { Archive, ExternalLink, FilePen, ListChecks, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { bulkUpdateAnnouncements } from "@/app/admin/announcements/actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { BulkAnnouncementAction } from "@/lib/announcements"

export type AnnouncementRow = {
  id: string
  title: string
  status: string
  /** Published date as ISO, and as displayed. */
  date: string
  dateLabel: string
  source: string | null
  sourceUrl: string | null
}

const plural = (n: number) => `${n} ${n === 1 ? "announcement" : "announcements"}`
const DONE: Record<BulkAnnouncementAction, string> = { publish: "published", draft: "moved to Draft", archive: "archived", delete: "deleted" }

/**
 * Admin announcements list: the status tabs, sort/search controls and table, with an
 * optional selection mode (Select → checkboxes + bulk actions; Cancel → back to the
 * plain table). `filterKey` identifies the current tab/sort/search: a selection made
 * under one filter never applies under another, so hidden rows can't be acted on.
 */
export function AnnouncementTable({ rows, tabs, controls, filterKey, empty }: {
  rows: AnnouncementRow[]
  tabs: React.ReactNode
  controls: React.ReactNode
  filterKey: string
  /** Shown instead of the table when there are no rows (empty state or load error). */
  empty: React.ReactNode
}) {
  const router = useRouter()
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: filterKey, ids: new Set() })
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    setConfirmDelete(false)
    select([])
  }

  function run(action: BulkAnnouncementAction) {
    if (!selectedIds.length) return
    const ids = selectedIds
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await bulkUpdateAnnouncements(ids, action)
        if (!result.ok) return setMessage({ tone: "alert", text: result.error })
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

      {message && !selecting && (
        <p role={message.tone} className={message.tone === "alert" ? "mt-3 text-sm text-destructive" : "mt-3 text-sm text-muted-foreground"}>{message.text}</p>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border bg-background">
        {rows.length === 0 ? (
          empty
        ) : (
          <>
            {selecting && (
              <div className="flex min-h-12 flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2" aria-live="polite">
                <span className="mr-1 text-sm font-medium">{count ? `${count} selected` : "Select announcements"}</span>
                <Button size="sm" variant="outline" disabled={pending || !count} onClick={() => run("publish")}>
                  <Send aria-hidden="true" />
                  Publish
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !count} onClick={() => run("draft")}>
                  <FilePen aria-hidden="true" />
                  Move to Draft
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !count} onClick={() => run("archive")}>
                  <Archive aria-hidden="true" />
                  Archive
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !count} className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
                {message?.tone === "alert" && <p role="alert" className="w-full text-sm text-destructive">{message.text}</p>}
              </div>
            )}

            <div role="region" aria-label="Announcements table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    {selecting && (
                      <th scope="col" className="w-10 py-2.5 pr-1 pl-4">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          disabled={pending}
                          onChange={(e) => select(e.target.checked ? rows.map((r) => r.id) : [])}
                          aria-label="Select all visible announcements"
                          className="size-4 cursor-pointer align-middle accent-primary"
                        />
                      </th>
                    )}
                    <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Title</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
                    <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((a) => {
                    const isSelected = selecting && selected.has(a.id)
                    return (
                      <tr key={a.id} className={isSelected ? "bg-accent/40" : "hover:bg-muted/40"}>
                        {selecting && (
                          <td className="py-3 pr-1 pl-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={pending}
                              onChange={(e) => toggle(a.id, e.target.checked)}
                              aria-label={`Select ${a.title}`}
                              className="size-4 cursor-pointer align-middle accent-primary"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          <time dateTime={a.date}>{a.dateLabel}</time>
                        </td>
                        <td className="min-w-56 px-4 py-3">
                          <Link href={`/admin/announcements/${a.id}`} className="font-medium hover:text-primary hover:underline">
                            {a.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td className="max-w-56 px-4 py-3 text-muted-foreground">
                          {a.source && a.sourceUrl ? (
                            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-foreground hover:underline">
                              <span className="truncate">{a.source}</span>
                              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          ) : (
                            <span className="block truncate">{a.source ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/announcements/${a.id}`} className="font-medium text-primary hover:underline">
                            Edit<span className="sr-only"> {a.title}</span>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={(next) => { if (!pending) setConfirmDelete(next) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete {plural(count)}?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {message?.tone === "alert" && <p role="alert" className="text-sm text-destructive">{message.text}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending || count === 0} onClick={() => run("delete")}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
