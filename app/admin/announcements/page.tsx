import { Megaphone, Plus } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

export default async function AdminAnnouncementsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ timezone }, { data: announcements }] = await Promise.all([
    getBranding(),
    supabase
      .from("announcements")
      .select("id, title, publish_at, status, departments(code)")
      .order("publish_at", { ascending: false }),
  ])

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Official notices for all students or for a specific college."
      >
        <Link href="/admin/announcements/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden="true" />
          New announcement
        </Link>
      </PageHeader>

      <div className="mt-6 overflow-hidden rounded-lg border bg-background">
        {announcements && announcements.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Title</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Department</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {announcements.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatDate(a.publish_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.departments?.code ?? "University-wide"}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/announcements/${a.id}`} className="font-medium text-primary hover:underline">
                      Edit<span className="sr-only"> {a.title}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-2">
            <EmptyState icon={Megaphone} title="No announcements yet." description="Create the first announcement for students." />
          </div>
        )}
      </div>
    </>
  )
}
