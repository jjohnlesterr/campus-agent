"use client"

import { cn } from "cn"
import { ChevronDown, Loader2, MoreHorizontal, Plus, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { type BuildingInput, saveBuilding, setBuildingActive } from "@/app/admin/campus-map/actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  type DirectoryBuilding,
  type SearchTerms,
  describeBuildingContents,
  directoryWindow,
  groupPlaces,
  matchesDirectorySearch,
  placesMatchingSearch,
} from "@/lib/campus/directory"

type Feedback = { error: boolean; text: string } | null

/** Buildings rendered per batch while browsing (search always shows every match). */
const BATCH = 10

/**
 * Buildings & Locations directory for admins: collapsible rows in building-number order,
 * search, add, edit (building and the offices inside it in one form), archive/restore.
 * Answers to "Where is…?" come from these records. `searchTerms` are extra search-only
 * words (college codes, legacy building aliases) and are never saved.
 */
export function CampusDirectoryEditor({ buildings, searchTerms }: { buildings: DirectoryBuilding[]; searchTerms: [string, string[]][] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [showArchived, setShowArchived] = useState(false)
  // Rows the admin opened or closed by hand, for the current search only: a new search
  // starts again from its own default (buildings with a matching office open).
  const [toggled, setToggled] = useState<{ query: string; open: Map<string, boolean> }>({ query: "", open: new Map() })

  const extra: SearchTerms = useMemo(() => new Map(searchTerms), [searchTerms])
  const searching = query.trim().length > 0
  const archivedCount = buildings.filter((b) => !b.isActive).length
  const visible = useMemo(
    () => buildings
      .filter((b) => (showArchived || b.isActive) && matchesDirectorySearch(b, query, extra)),
    [buildings, query, showArchived, extra],
  )
  const nextNumber = Math.max(0, ...buildings.map((b) => b.number)) + 1
  const overrides = toggled.query === query ? toggled.open : new Map<string, boolean>()

  // Incremental rendering: the whole directory is already loaded (two batched queries on
  // the server), so search covers every building; browsing renders it 10 rows at a time.
  // A sentinel below the list reveals the next batch as it nears the viewport.
  const [limit, setLimit] = useState(BATCH)
  const [revealing, startReveal] = useTransition()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { shown, hasMore } = useMemo(() => directoryWindow(visible, limit, searching), [visible, limit, searching])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!hasMore || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect() // one batch per sighting; the effect re-observes after it renders
        startReveal(() => setLimit((current) => current + BATCH))
      },
      { rootMargin: "0px 0px 320px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, limit])

  function setOpen(id: string, open: boolean) {
    const next = new Map(overrides)
    next.set(id, open)
    setToggled({ query, open: next })
  }

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, after?: () => void) {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await task()
        if (!result.ok) return setFeedback({ error: true, text: result.error })
        after?.()
        setFeedback({ error: false, text: success })
        router.refresh()
      } catch {
        setFeedback({ error: true, text: "The request could not be completed. Refresh the page and try again." })
      }
    })
  }

  return (
    <section aria-labelledby="directory-heading" className="mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 id="directory-heading" className="text-lg font-semibold">Buildings &amp; Locations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search buildings, offices, or campus locations.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
          <div className="relative w-full sm:w-80">
            <label htmlFor="directory-search" className="sr-only">Search buildings, offices, or campus locations</label>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="directory-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search building, office, or location…" className="h-9 pl-8" />
          </div>
          <Button className="h-9 shrink-0" disabled={pending || editing !== null} onClick={() => { setFeedback(null); setEditing("new") }}>
            <Plus aria-hidden="true" />
            Add building
          </Button>
        </div>
      </div>

      {(searching || archivedCount > 0) && (
        <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
          {searching && `${visible.length} ${visible.length === 1 ? "result" : "results"}`}
          {searching && archivedCount > 0 && " · "}
          {archivedCount > 0 && (
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="cursor-pointer rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              {showArchived ? "Hide" : "Show"} {archivedCount} archived
            </button>
          )}
        </p>
      )}

      <div aria-live="polite">
        {pending && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Saving…</p>}
        {feedback && !pending && <p role={feedback.error ? "alert" : "status"} className={cn("mt-3 text-sm", feedback.error ? "text-destructive" : "text-muted-foreground")}>{feedback.text}</p>}
      </div>

      {editing === "new" && (
        <div className="mt-4">
          <BuildingForm
            initial={{ id: null, number: nextNumber, name: "", description: null, isActive: true, places: [] }}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSave={(input) => run(() => saveBuilding(input), `Building ${input.number} added.`, () => setEditing(null))}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-background px-5 py-8 text-center text-sm text-muted-foreground">
          {searching ? "No building, office, or location matches your search." : "No buildings yet. Add the first building from the map."}
        </p>
      ) : (
        <ul className="mt-4 divide-y overflow-hidden rounded-lg border bg-background" aria-label="Buildings">
          {shown.map((building) => {
            const hits = placesMatchingSearch(building, query, extra)
            const open = overrides.get(building.id) ?? (searching && hits.size > 0)
            return (
              <li key={building.id}>
                {editing === building.id ? (
                  <div className="p-3 sm:p-4">
                    <BuildingForm
                      initial={building}
                      pending={pending}
                      onCancel={() => setEditing(null)}
                      onSave={(input) => run(() => saveBuilding(input), `Building ${input.number} saved.`, () => setEditing(null))}
                    />
                  </div>
                ) : (
                  <BuildingRow
                    building={building}
                    open={open}
                    hits={hits}
                    disabled={pending || editing !== null}
                    onToggle={() => setOpen(building.id, !open)}
                    onEdit={() => { setFeedback(null); setEditing(building.id) }}
                    onArchive={(active) => run(() => setBuildingActive(building.id, active), active ? `Building ${building.number} restored.` : `Building ${building.number} archived. It no longer appears on the map page or in answers.`)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground" role="status">
          <Loader2 className={cn("size-3.5", revealing && "animate-spin")} aria-hidden="true" />
          Loading more buildings… ({shown.length} of {visible.length})
        </div>
      )}
    </section>
  )
}

/** One building: a summary row that expands to its offices grouped by hall and floor. */
function BuildingRow({ building, open, hits, disabled, onToggle, onEdit, onArchive }: {
  building: DirectoryBuilding
  open: boolean
  hits: Set<string>
  disabled: boolean
  onToggle: () => void
  onEdit: () => void
  onArchive: (active: boolean) => void
}) {
  const groups = groupPlaces(building.places)
  const expandable = groups.length > 0 || !!building.description
  const panelId = `building-panel-${building.id}`

  return (
    <article aria-labelledby={`building-${building.id}`} className={cn(open && "bg-muted/20", !building.isActive && "opacity-70")}>
      <div className={cn("flex items-center gap-2 px-3 py-2.5 sm:px-4", expandable && "hover:bg-muted/40")}>
        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BuildingSummary building={building} />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 py-0.5">
            <BuildingSummary building={building} />
          </div>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {building.isActive && <Button variant="ghost" size="sm" disabled={disabled} onClick={onEdit}>Edit<span className="sr-only"> Building {building.number}</span></Button>}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for Building ${building.number}`} disabled={disabled} />}>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              {building.isActive
                ? <DropdownMenuItem onClick={() => onArchive(false)}>Archive building</DropdownMenuItem>
                : <DropdownMenuItem onClick={() => onArchive(true)}>Restore building</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          {expandable ? (
            <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={`${open ? "Collapse" : "Expand"} Building ${building.number}`} aria-expanded={open} aria-controls={panelId}>
              <ChevronDown className={cn("transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
            </Button>
          ) : (
            <span className="size-7" aria-hidden="true" />
          )}
        </div>
      </div>

      {expandable && open && (
        <div id={panelId} className="border-t px-4 pt-3 pb-4 sm:px-5 sm:pl-[4.75rem]">
          {building.description && <p className="mb-3 max-w-prose text-sm text-muted-foreground">{building.description}</p>}
          {groups.length > 0 && (
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <div key={`${group.area}-${group.floor}`} className="min-w-0">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {[group.area, group.floor].filter(Boolean).join(" · ") || "Inside"}
                  </h4>
                  <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                    {group.places.map((place) => (
                      <li key={place.id} className={cn("break-words", hits.has(place.id) && "-mx-1.5 rounded bg-accent px-1.5 font-medium text-accent-foreground")}>
                        {place.name}
                        {hits.has(place.id) && <span className="sr-only"> (matches your search)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function BuildingSummary({ building }: { building: DirectoryBuilding }) {
  return (
    <>
      <span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-md border bg-background leading-none" aria-hidden="true">
        <span className="text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">Bldg</span>
        <span className="mt-0.5 text-sm font-semibold tabular-nums">{building.number}</span>
      </span>
      <span className="min-w-0">
        <span id={`building-${building.id}`} className="block truncate font-medium">
          <span className="sr-only">Building {building.number}: </span>
          {building.name}
          {!building.isActive && <span className="ml-2 align-middle"><StatusBadge status="archived" /></span>}
        </span>
        <span className="block text-xs text-muted-foreground">{describeBuildingContents(building)}</span>
      </span>
    </>
  )
}

type PlaceRow = { key: string; id: string | null; name: string; area: string; floor: string; aliases: string }

function BuildingForm({ initial, pending, onCancel, onSave }: {
  initial: DirectoryBuilding | (Omit<DirectoryBuilding, "id"> & { id: null })
  pending: boolean
  onCancel: () => void
  onSave: (input: BuildingInput) => void
}) {
  const [number, setNumber] = useState(String(initial.number))
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? "")
  const [rows, setRows] = useState<PlaceRow[]>(() =>
    groupPlaces(initial.places).flatMap((g) => g.places).map((p) => ({ key: p.id, id: p.id, name: p.name, area: p.area ?? "", floor: p.floor ?? "", aliases: p.aliases.join(", ") })),
  )
  const [error, setError] = useState<string | null>(null)
  const formId = initial.id ?? "new"

  const update = (key: string, field: keyof PlaceRow, value: string) => setRows((all) => all.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  const addRow = () => {
    const last = rows.at(-1)
    setRows((all) => [...all, { key: crypto.randomUUID(), id: null, name: "", area: last?.area ?? "", floor: last?.floor ?? "", aliases: "" }])
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const n = Number(number)
    if (!Number.isInteger(n) || n < 1) return setError("Enter the building number from the map.")
    if (name.trim().length < 2) return setError("Enter the building name.")
    const places = rows.filter((r) => r.name.trim() || r.id)
    if (places.some((r) => r.name.trim().length < 2)) return setError("Each office or place needs a name, or remove the empty row.")
    setError(null)
    onSave({
      id: initial.id,
      number: n,
      name: name.trim(),
      description: description.trim(),
      places: places.map((r) => ({
        id: r.id,
        name: r.name.trim(),
        area: r.area.trim(),
        floor: r.floor.trim(),
        aliases: r.aliases.split(",").map((a) => a.trim()).filter(Boolean),
      })),
    })
  }

  return (
    <form onSubmit={submit} aria-label={initial.id ? `Edit Building ${initial.number}` : "New building"} className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4 sm:p-5">
      <p className="text-sm font-semibold">{initial.id ? `Edit Building ${initial.number}` : "New building"}</p>
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`b-number-${formId}`}>Number</Label>
          <Input id={`b-number-${formId}`} value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" required className="h-9 bg-background" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`b-name-${formId}`}>Building name</Label>
          <Input id={`b-name-${formId}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required className="h-9 bg-background" autoFocus={!initial.id} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`b-desc-${formId}`}>Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id={`b-desc-${formId}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="h-9 bg-background" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Offices &amp; places inside</legend>
        <p className="text-xs text-muted-foreground">Floor as on the map (L1, L2…). Use Hall / wing only for complexes such as Building 7. Other names are extra search words, separated by commas.</p>
        {rows.length > 0 && (
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_5rem_minmax(0,1.4fr)_2.25rem] gap-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Office or place</span><span>Hall / wing</span><span>Floor</span><span>Other names</span><span className="sr-only">Remove</span>
          </div>
        )}
        <ul className="flex flex-col gap-3 md:gap-2">
          {rows.map((row, i) => (
            <li key={row.key} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_5rem_minmax(0,1.4fr)_2.25rem] md:items-center md:border-0 md:bg-transparent md:p-0">
              <Input aria-label={`Office or place ${i + 1}`} value={row.name} onChange={(e) => update(row.key, "name", e.target.value)} placeholder="e.g. Registrar" maxLength={200} className="h-9 bg-background" />
              <Input aria-label={`Hall or wing for office ${i + 1}`} value={row.area} onChange={(e) => update(row.key, "area", e.target.value)} placeholder="—" maxLength={200} className="h-9 bg-background" />
              <Input aria-label={`Floor for office ${i + 1}`} value={row.floor} onChange={(e) => update(row.key, "floor", e.target.value)} placeholder="L1" maxLength={40} className="h-9 bg-background" />
              <Input aria-label={`Other names for office ${i + 1}`} value={row.aliases} onChange={(e) => update(row.key, "aliases", e.target.value)} placeholder="e.g. clinic" maxLength={300} className="h-9 bg-background" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove office ${i + 1}${row.name ? ` (${row.name})` : ""}`} onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}>
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={addRow}>
          <Plus aria-hidden="true" />
          Add office or place
        </Button>
        <p className="text-xs text-muted-foreground">Removing an office archives it: it disappears from the map page and answers, and can be added again later.</p>
      </fieldset>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save building"}</Button>
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
