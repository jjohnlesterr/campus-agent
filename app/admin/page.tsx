import { CircleCheck, ChevronRight } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function AdminDashboardPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()
  const now = new Date().toISOString()

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)
  const [published, drafts, documents, events, announcements, offices, departments, locations] =
    await Promise.all([
      count(supabase.from("guidelines").select("*", { count: "exact", head: true }).eq("status", "published")),
      count(supabase.from("guidelines").select("*", { count: "exact", head: true }).eq("status", "draft")),
      count(supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "ready")),
      count(
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("status", "published")
          .gte("starts_at", now)
      ),
      count(
        supabase
          .from("announcements")
          .select("*", { count: "exact", head: true })
          .eq("status", "published")
          .or(`expires_at.is.null,expires_at.gt.${now}`)
      ),
      count(supabase.from("offices").select("*", { count: "exact", head: true })),
      count(supabase.from("departments").select("*", { count: "exact", head: true })),
      count(supabase.from("campus_locations").select("*", { count: "exact", head: true })),
    ])

  const stats = [
    { label: "Published guides", value: published, href: "/admin/knowledge" },
    { label: "Draft guides", value: drafts, href: "/admin/knowledge" },
    { label: "Ready documents", value: documents, href: "/admin/documents" },
    { label: "Upcoming events", value: events, href: "/admin/events" },
    { label: "Active announcements", value: announcements, href: "/admin/announcements" },
    { label: "Offices", value: offices, href: "/admin/offices" },
  ]

  const setup = [
    { label: "Add colleges and programs", done: departments > 0, href: "/admin/settings" },
    { label: "Add offices with heads and hours", done: offices > 0, href: "/admin/offices" },
    { label: "Add campus locations from the official map", done: locations > 0, href: "/admin/locations" },
    { label: "Upload the student handbook", done: documents > 0, href: "/admin/documents" },
    { label: "Import the calendar of activities", done: events > 0, href: "/admin/events" },
    { label: "Publish the first school guide", done: published > 0, href: "/admin/knowledge" },
  ]
  const doneCount = setup.filter((s) => s.done).length

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${profile.full_name ?? profile.email}. Overview of the verified content students can see.`}
      />

      <section aria-label="Content summary" className="mt-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-background">
              <Link
                href={s.href}
                className="flex h-full flex-col gap-1 px-4 py-4 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
              </Link>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="setup-heading" className="mt-8 rounded-lg border bg-background">
        <div className="flex items-baseline justify-between gap-4 border-b px-5 py-4">
          <h2 id="setup-heading" className="font-semibold">
            Set up Campus Agent
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {doneCount} of {setup.length} done
          </p>
        </div>
        <ol className="divide-y">
          {setup.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-5 py-3.5 text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                {item.done ? (
                  <CircleCheck className="size-4 shrink-0 text-primary" aria-label="Done" />
                ) : (
                  <span aria-label="Not done" className="size-4 shrink-0 rounded-full border-[1.5px] border-input" />
                )}
                <span className={item.done ? "text-muted-foreground line-through decoration-border" : ""}>
                  {item.label}
                </span>
                <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
