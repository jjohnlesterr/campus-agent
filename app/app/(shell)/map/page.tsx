import { Map as MapIcon, MapPin } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Structure only: the official campus map image and marker positions come later.
export default async function CampusMapPage() {
  await requireProfile()
  const supabase = await createClient()
  const { data: locations } = await supabase
    .from("campus_locations")
    .select("id, name, building_name, floor, offices(name)")
    .order("name")

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Campus Map"
        description="Find buildings, offices and student service areas on campus."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section
          aria-label="Campus map"
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-6 text-center"
        >
          <MapIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">The official campus map is coming soon</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Locations listed here will be marked on the map once it has been added.
          </p>
        </section>

        <section aria-labelledby="locations-heading">
          <h2 id="locations-heading" className="text-sm font-semibold">
            Locations
          </h2>
          {locations && locations.length > 0 ? (
            <ul className="mt-3 divide-y border-y">
              {locations.map((l) => (
                <li key={l.id} className="flex items-start gap-3 py-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">{l.name}</p>
                    {l.offices.length > 0 && (
                      <p className="text-sm text-muted-foreground">{l.offices.map((o) => o.name).join(", ")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No locations have been added yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
