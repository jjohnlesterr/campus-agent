import { Building2, Plus } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function AdminOfficesPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: offices } = await supabase
    .from("offices")
    .select("id, name, head_name, office_hours, campus_locations(name)")
    .order("name")

  return (
    <>
      <PageHeader title="Offices" description="Office names, heads, hours and campus location.">
        <Link href="/admin/offices/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          New office
        </Link>
      </PageHeader>

      <div className="mt-6 overflow-hidden rounded-lg border bg-background">
        {offices && offices.length > 0 ? (
          <div role="region" aria-label="Offices table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Office</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Head</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Hours</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Location</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {offices.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.head_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.office_hours ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.campus_locations?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/offices/${o.id}`} className="font-medium text-primary hover:underline">
                        Edit<span className="sr-only"> {o.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-2">
            <EmptyState icon={Building2} title="No offices yet." description="Add the first office to the directory." />
          </div>
        )}
      </div>
    </>
  )
}
