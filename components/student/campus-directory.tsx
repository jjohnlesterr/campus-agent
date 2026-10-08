"use client"

import { cn } from "cn"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { type DirectoryBuilding, groupPlaces, matchesDirectorySearch, matchingPlaces } from "@/lib/campus/directory"

/**
 * Searchable list of buildings for the Campus Map page. Each building keeps the
 * #building-N anchor that "View Campus Map" links to from Campus Agent answers.
 */
export function CampusDirectory({ buildings }: { buildings: DirectoryBuilding[] }) {
  const [query, setQuery] = useState("")
  const visible = useMemo(() => buildings.filter((b) => matchesDirectorySearch(b, query)), [buildings, query])

  return (
    <section aria-labelledby="directory-heading">
      <h2 id="directory-heading" className="sr-only">Buildings and offices</h2>
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
        <ol className="mt-3 divide-y border-y">
          {visible.map((building) => {
            const hits = query ? matchingPlaces(building, query) : null
            return (
              <li
                key={building.id}
                id={`building-${building.number}`}
                className="flex scroll-mt-6 items-start gap-3 py-4 target:-mx-2 target:rounded-md target:bg-accent target:px-2"
              >
                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border px-1.5 text-xs font-semibold tabular-nums" aria-hidden="true">
                  {building.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Building {building.number}</p>
                  <h3 className="font-medium">{building.name}</h3>
                  {groupPlaces(building.places).map((group) => (
                    <div key={`${group.area}-${group.floor}`} className="mt-2 text-sm">
                      {(group.area || group.floor) && (
                        <p className="text-xs font-medium text-muted-foreground">{[group.area, group.floor].filter(Boolean).join(" · ")}</p>
                      )}
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {group.places.map((place) => (
                          <li key={place.id} className={cn(hits && !hits.has(place.id) && "text-muted-foreground", hits?.has(place.id) && query && "font-medium")}>
                            {place.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
