"use client"

import { cn } from "cn"
import { ChevronDown, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { type DirectoryBuilding, type SearchTerms, groupPlaces, matchesDirectorySearch, matchingPlaces } from "@/lib/campus/directory"

/**
 * Searchable, read-only list of buildings for the Campus Map page: each row expands to its
 * offices and locations (searching opens every match). Each building keeps the
 * #building-N anchor that "View Campus Map" links to from Campus Agent answers.
 */
export function CampusDirectory({ buildings, searchTerms = [] }: { buildings: DirectoryBuilding[]; searchTerms?: [string, string[]][] }) {
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const extra: SearchTerms = useMemo(() => new Map(searchTerms), [searchTerms])
  const visible = useMemo(() => buildings.filter((b) => matchesDirectorySearch(b, query, extra)), [buildings, query, extra])

  function toggle(id: string) {
    setOpenIds((ids) => {
      const next = new Set(ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section aria-labelledby="directory-heading">
      <h2 id="directory-heading" className="sr-only">Buildings and locations</h2>
      <div className="relative">
        <label htmlFor="campus-search" className="sr-only">Search office, building, or campus location</label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="campus-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search office, building, or campus location..."
          className="h-10 pl-9"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {query ? `${visible.length} ${visible.length === 1 ? "building matches" : "buildings match"}` : `${buildings.length} buildings · numbers match the campus map`}
      </p>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing on the campus map matches “{query}”. Try another office or building name, or a building number.
        </p>
      ) : (
        <ol className="mt-3 divide-y overflow-hidden rounded-lg border bg-background">
          {visible.map((building) => {
            const hits = query ? matchingPlaces(building, query) : null
            const groups = groupPlaces(building.places)
            const expandable = groups.length > 0 || !!building.description
            // Searching opens every match; otherwise rows open on click.
            const open = expandable && (Boolean(query) || openIds.has(building.id))
            const panelId = `building-panel-${building.id}`
            return (
              <li key={building.id} id={`building-${building.number}`} className="scroll-mt-6 target:bg-accent/60">
                <button
                  type="button"
                  onClick={() => expandable && toggle(building.id)}
                  aria-expanded={expandable ? open : undefined}
                  aria-controls={expandable ? panelId : undefined}
                  disabled={!expandable}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none enabled:cursor-pointer enabled:hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-md border bg-background leading-none" aria-hidden="true">
                    <span className="text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">Bldg</span>
                    <span className="mt-0.5 text-sm font-semibold tabular-nums">{building.number}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">Building {building.number}: </span>
                    <span className="block truncate font-medium">{building.name}</span>
                    {building.places.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {building.places.length} {building.places.length === 1 ? "office or location" : "offices and locations"}
                      </span>
                    )}
                  </span>
                  {expandable && (
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
                  )}
                </button>
                {open && (
                  <div id={panelId} className="border-t bg-muted/20 px-4 pt-3 pb-4 sm:pl-[4.75rem]">
                    {building.description && <p className="mb-3 max-w-prose text-sm text-muted-foreground">{building.description}</p>}
                    {groups.map((group) => (
                      <div key={`${group.area}-${group.floor}`} className="mt-2 text-sm first:mt-0">
                        {(group.area || group.floor) && (
                          <p className="text-xs font-medium text-muted-foreground">{[group.area, group.floor].filter(Boolean).join(" · ")}</p>
                        )}
                        <ul className="mt-0.5 flex flex-col gap-0.5">
                          {group.places.map((place) => (
                            <li key={place.id} className={cn(hits && !hits.has(place.id) && "text-muted-foreground", hits?.has(place.id) && "font-medium")}>
                              {place.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
