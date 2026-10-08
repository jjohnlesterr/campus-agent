import { redirect } from "next/navigation"

// The campus map, legend and building directory moved to Admin › Campus Map.
export default function AdminLocationsPage() {
  redirect("/admin/campus-map")
}
