"use client"

import { Pencil, Plus, Settings2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteLegendEntry, saveLegendEntry } from "@/app/admin/campus-map/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export type LegendRow = { id: string; code: string; label: string; description: string | null }

/**
 * Map Legend: what each symbol on the map means (CR → Comfort Room). Campus Agent uses
 * it for "Is there parking?" / "What does CR mean?" — it never claims an exact spot.
 * The page shows a compact read-only grid; editing happens in Manage legend.
 */
export function MapLegendEditor({ entries }: { entries: LegendRow[] }) {
  const [open, setOpen] = useState(false)

  return (
    <section aria-labelledby="legend-heading" className="mt-6 rounded-lg border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="legend-heading" className="font-semibold">Map Legend</h2>
          <p className="text-xs text-muted-foreground">Symbols on the map and what they mean.</p>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Settings2 aria-hidden="true" />
          Manage legend
        </Button>
      </div>
      {entries.length ? (
        <ul className="grid grid-cols-1 gap-2 p-4 min-[420px]:grid-cols-2 sm:p-5 md:grid-cols-3 xl:grid-cols-4" aria-label="Map legend">
          {entries.map((entry) => (
            <li key={entry.id} className="flex min-w-0 items-center gap-2.5 rounded-md border px-2.5 py-1.5">
              <Symbol code={entry.code} />
              <span className="min-w-0 truncate text-sm" title={entry.label}>{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">No legend symbols yet. Use Manage legend to add the symbols shown on the map.</p>
      )}
      <ManageLegendDialog entries={entries} open={open} onOpenChange={setOpen} />
    </section>
  )
}

function Symbol({ code }: { code: string }) {
  return <span className="flex h-6 min-w-9 shrink-0 items-center justify-center rounded border bg-muted/50 px-1.5 text-xs font-semibold">{code}</span>
}

/** Add, edit and delete legend symbols. Delete asks for a second click to confirm. */
function ManageLegendDialog({ entries, open, onOpenChange }: { entries: LegendRow[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = pending || editing !== null

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await task()
        if (!result.ok) return setError(result.error)
        setEditing(null)
        setConfirmDelete(null)
        router.refresh()
      } catch {
        setError("The request could not be completed. Refresh the page and try again.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) { setEditing(null); setConfirmDelete(null); setError(null) }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle>Manage legend</DialogTitle>
          <DialogDescription>Use the symbols exactly as they appear on the map, e.g. CR → Comfort Room.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="border-b px-5 py-2.5 text-sm text-destructive">{error}</p>}
        <ul className="divide-y" aria-label="Legend symbols">
          {entries.map((entry) => (
            <li key={entry.id} className="px-5 py-2.5">
              {editing === entry.id ? (
                <LegendForm entry={entry} pending={pending} onCancel={() => setEditing(null)} onSave={(values) => run(() => saveLegendEntry({ id: entry.id, ...values }))} />
              ) : (
                <div className="flex items-center gap-2.5">
                  <Symbol code={entry.code} />
                  <span className="min-w-0 flex-1 text-sm">{entry.label}</span>
                  {confirmDelete === entry.id ? (
                    <>
                      <Button variant="destructive" size="sm" disabled={pending} onClick={() => run(() => deleteLegendEntry(entry.id))}>
                        {pending ? "Deleting…" : "Confirm delete"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Edit ${entry.code}`} onClick={() => { setError(null); setConfirmDelete(null); setEditing(entry.id) }}>
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled={busy} aria-label={`Delete ${entry.code}`} onClick={() => { setError(null); setConfirmDelete(entry.id) }}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
          {editing === "new" && (
            <li className="px-5 py-2.5">
              <LegendForm entry={{ code: "", label: "", description: null }} pending={pending} onCancel={() => setEditing(null)} onSave={(values) => run(() => saveLegendEntry({ id: null, ...values }))} />
            </li>
          )}
          {entries.length === 0 && editing !== "new" && <li className="px-5 py-6 text-sm text-muted-foreground">No legend symbols yet.</li>}
        </ul>
        <div className="border-t px-5 py-3">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { setError(null); setConfirmDelete(null); setEditing("new") }}>
            <Plus aria-hidden="true" />
            Add symbol
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LegendForm({ entry, pending, onCancel, onSave }: {
  entry: { code: string; label: string; description: string | null }
  pending: boolean
  onCancel: () => void
  onSave: (values: { code: string; label: string; description: string }) => void
}) {
  const [code, setCode] = useState(entry.code)
  const [label, setLabel] = useState(entry.label)
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave({ code: code.trim(), label: label.trim(), description: entry.description ?? "" }) }}
      className="flex flex-wrap items-center gap-2"
    >
      <Input aria-label="Symbol" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CR" maxLength={10} required className="h-8 w-20 bg-background" autoFocus />
      <Input aria-label="Meaning" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Comfort Room" maxLength={120} required className="h-8 min-w-40 flex-1 bg-background" />
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>Cancel</Button>
    </form>
  )
}
