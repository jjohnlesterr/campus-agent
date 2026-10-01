import { Map as MapIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLocationsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: locations } = await supabase
    .from("campus_locations")
    .select("id, name, map_x, map_y, offices(name)")
    .order("name")

  return (
    <>
      <PageHeader
        title="Campus Map"
        description="Campus locations. They are created automatically when you set an office's location; map placement comes with the official campus map."
      />

      <div className="mt-6 overflow-hidden rounded-lg border bg-background">
        {locations && locations.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Location</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Offices</th>
                <th scope="col" className="px-4 py-2.5 font-medium">On map</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {locations.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.offices.map((o) => o.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.map_x !== null ? "Placed" : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2">
            <EmptyState
              icon={MapIcon}
              title="No campus locations yet."
              description="Set a location on an office and it will appear here."
            />
          </div>
        )}
      </div>
    </>
  )
}
