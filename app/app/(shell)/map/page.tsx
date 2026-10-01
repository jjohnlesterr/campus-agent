import { ExternalLink, Map as MapIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { getActiveCampusMap } from "@/lib/campus/locations"
import { createClient } from "@/lib/supabase/server"

type LegendRow = { id: string; name: string; building_name: string | null; building_number: number | null; floor: string | null }

export default async function CampusMapPage() {
  await requireProfile()
  const supabase = await createClient()
  const [{ map }, { data: rows }] = await Promise.all([
    getActiveCampusMap(supabase),
    // Only entries from the official map legend.
    supabase
      .from("campus_locations")
      .select("id, name, building_name, building_number, floor")
      .not("building_number", "is", null)
      .order("building_number")
      .order("floor", { nullsFirst: true })
      .order("name"),
  ])
  // Signed with the student's own session; storage policy allows Ready Campus Map files only.
  const { data: signed } =
    map && map.mime_type.startsWith("image/")
      ? await supabase.storage.from("documents").createSignedUrl(map.file_path, 60 * 60)
      : { data: null }

  // Group the legend by building: the building's own row, then what's inside it.
  const buildings = new Map<number, { title: string; places: LegendRow[] }>()
  for (const row of (rows ?? []) as LegendRow[]) {
    if (row.building_number === null) continue
    const entry = buildings.get(row.building_number) ?? { title: row.building_name ?? row.name, places: [] }
    if (row.name === row.building_name) entry.title = row.name
    else entry.places.push(row)
    buildings.set(row.building_number, entry)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Campus Map"
        description="Find buildings, offices and colleges. Numbers match the buildings on the official campus map."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {signed?.signedUrl ? (
          <figure className="overflow-hidden rounded-lg border bg-background lg:sticky lg:top-6">
            <a href={signed.signedUrl} target="_blank" rel="noreferrer" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
              <img src={signed.signedUrl} alt="Official campus map with numbered buildings and legend" className="h-auto w-full" />
            </a>
            <figcaption className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
              Official campus map
              <a href={signed.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open full size
              </a>
            </figcaption>
          </figure>
        ) : (
          <section
            aria-label="Campus map"
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-6 text-center"
          >
            <MapIcon className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">The official campus map isn&apos;t available yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">Use the building list to find offices and colleges.</p>
          </section>
        )}

        <section aria-labelledby="locations-heading">
          <h2 id="locations-heading" className="text-sm font-semibold">
            Buildings
          </h2>
          {buildings.size > 0 ? (
            <ol className="mt-3 divide-y border-y">
              {[...buildings].map(([number, building]) => (
                <li
                  key={number}
                  id={`building-${number}`}
                  className="flex scroll-mt-6 items-start gap-3 py-3 target:-mx-2 target:rounded-md target:bg-accent target:px-2"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums">
                    {number}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{building.title}</p>
                    {building.places.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                        {building.places.map((p) => (
                          <li key={p.id}>
                            {p.floor && <span className="mr-1.5 font-medium text-foreground tabular-nums">{p.floor}</span>}
                            {p.name}
                            {/* Wings of a complex, e.g. "Dr. Jorge Bocobo Hall (Left Wing)" in Building 7 */}
                            {p.building_name && p.building_name !== building.title && (
                              <span className="text-xs"> · {p.building_name.split(",")[0]}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No locations have been added yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
