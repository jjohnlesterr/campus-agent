import { ExternalLink, Map as MapIcon } from "lucide-react"

import { CampusDirectory } from "@/components/student/campus-directory"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { getActiveCampusMap, getCampusDirectory } from "@/lib/campus/locations"
import { createClient } from "@/lib/supabase/server"

// The official map image plus a searchable directory of buildings and the offices
// inside them (the same records Campus Agent answers "Where is…?" from).
export default async function CampusMapPage() {
  await requireProfile()
  const supabase = await createClient()
  const [{ map }, buildings, { data: legend }] = await Promise.all([
    getActiveCampusMap(supabase),
    getCampusDirectory(supabase),
    supabase.from("campus_map_legend").select("code, label").order("sort_order").order("code"),
  ])
  // Signed with the student's own session; storage policy allows Ready Campus Map files only.
  const { data: signed } =
    map && map.mime_type.startsWith("image/")
      ? await supabase.storage.from("documents").createSignedUrl(map.file_path, 60 * 60)
      : { data: null }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Campus Map"
        description="Find buildings, offices and colleges. Building numbers match the official campus map."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          {signed?.signedUrl ? (
            <figure className="overflow-hidden rounded-lg border bg-background">
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
            <section aria-label="Campus map" className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-6 text-center">
              <MapIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">The official campus map isn&apos;t available yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">Use the building list to find offices and colleges.</p>
            </section>
          )}

          {legend && legend.length > 0 && (
            <section aria-labelledby="legend-heading" className="rounded-lg border bg-background px-4 py-3">
              <h2 id="legend-heading" className="text-sm font-semibold">Map legend</h2>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                {legend.map((entry) => (
                  <div key={entry.code} className="contents">
                    <dt className="font-semibold tabular-nums">{entry.code}</dt>
                    <dd className="text-muted-foreground">{entry.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {buildings.length > 0 ? (
          <CampusDirectory buildings={buildings} />
        ) : (
          <p className="text-sm text-muted-foreground">No buildings have been added yet.</p>
        )}
      </div>
    </div>
  )
}
