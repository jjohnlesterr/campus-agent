import { ExternalLink, Map as MapIcon } from "lucide-react"

import { CampusDirectoryEditor } from "@/components/admin/campus-directory-editor"
import { CampusMapImageControls } from "@/components/admin/campus-map-image-controls"
import { MapLegendEditor } from "@/components/admin/map-legend-editor"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { normalize } from "@/lib/campus/location-match"
import { getActiveCampusMap, getCampusDirectory } from "@/lib/campus/locations"
import { createClient } from "@/lib/supabase/server"

// Admin › Campus Information › Campus Map.
// The map image is the visual reference only (stored for this module, not a Knowledge
// Library source); the legend and the Buildings & Locations directory are structured
// records that answer location questions.
export default async function AdminCampusMapPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ timezone }, { map }, buildings, { data: legend }, { data: departments }, { data: buildingRows }] = await Promise.all([
    getBranding(),
    getActiveCampusMap(supabase),
    getCampusDirectory(supabase, { includeArchived: true }),
    supabase.from("campus_map_legend").select("id, code, label, description").order("sort_order").order("code"),
    supabase.from("departments").select("code, name"),
    // Legacy building rows carry building aliases ("gym"); searchable here as in answers.
    supabase.from("campus_locations").select("building_id, aliases").eq("location_type", "building"),
  ])
  // Private bucket: a short-lived signed link for admins.
  const { data: signed } = map ? await supabase.storage.from("documents").createSignedUrl(map.file_path, 60 * 60) : { data: null }

  // Search-only words (never saved): a college office also matches its code ("CECT").
  const codeByCollege = new Map((departments ?? []).map((d) => [normalize(d.name), d.code]))
  const searchTerms: [string, string[]][] = [
    ...buildings.flatMap((b) => b.places.flatMap((p) => {
      const code = codeByCollege.get(normalize(p.name))
      return code ? [[p.id, [code]] as [string, string[]]] : []
    })),
    ...(buildingRows ?? []).filter((r) => r.building_id && r.aliases.length).map((r) => [r.building_id!, r.aliases] as [string, string[]]),
  ]

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <PageHeader
        title="Campus Map"
        description="The campus map image, its legend, and the directory of buildings and offices that Campus Agent uses to answer “Where is…?”."
      />

      {map && signed?.signedUrl ? (
        <section aria-labelledby="map-heading" className="mt-6 overflow-hidden rounded-lg border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 id="map-heading" className="truncate font-semibold">Campus map image</h2>
              <p className="text-xs text-muted-foreground">
                {map.updated_at ? `Updated ${formatDate(map.updated_at, timezone, { month: "short", day: "numeric", year: "numeric" })}` : "Official campus map"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={signed.signedUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink aria-hidden="true" />
                View full size
              </a>
              <CampusMapImageControls hasMap />
            </div>
          </div>
          <div className="bg-muted/30 p-3 sm:p-4">
            {/* Native <img>, not next/image: the signed URL changes on every request (the optimizer
                cache would never hit) and the official map must stay full resolution to be readable.
                Async decoding keeps the large image from holding up the rest of the page. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
            <img src={signed.signedUrl} alt="Official campus map with numbered buildings and legend" decoding="async" className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md border bg-background" />
          </div>
        </section>
      ) : (
        <div className="mt-6 rounded-lg border bg-background p-2">
          <EmptyState icon={MapIcon} title="No campus map image yet." description="Upload the official campus map (PNG, JPG or WebP). Students see it on the Campus Map page. The building directory below works with or without it.">
            <CampusMapImageControls hasMap={false} />
          </EmptyState>
        </div>
      )}

      <MapLegendEditor entries={legend ?? []} />

      <CampusDirectoryEditor buildings={buildings} searchTerms={searchTerms} />
    </div>
  )
}
