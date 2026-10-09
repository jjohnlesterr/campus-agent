import type { LucideIcon } from "lucide-react"
import {
  Building2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  Library,
  Map as MapIcon,
  Megaphone,
  TriangleAlert,
  Users,
} from "lucide-react"
import Link from "next/link"
import { cn } from "cn"

import { describeStatus } from "@/app/admin/documents/document-stats"
import { DashboardClock } from "@/components/admin/dashboard-clock"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate, formatTime } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

function greeting(iso: string, timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(iso)))
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
/** A record saved again later than when it was created (more than a minute apart). */
const wasUpdated = (row: { created_at: string; updated_at: string }) => Date.parse(row.updated_at) - Date.parse(row.created_at) > 60_000

type Readiness = { label: string; status: "ready" | "review" | "failed"; detail: string; note?: string; href: string; icon: LucideIcon }
type Update = { at: string; action: string; title: string; href: string; status?: { tone: string; label?: string } }

// Admin › Dashboard: a compact operational overview — key counts, whether the content and
// configuration Campus Agent depends on is ready, and the
// latest changes. Everything is derived from existing records; there is no audit log, so
// "Recent updates" uses each record's created/updated timestamps.
export default async function AdminDashboardPage() {
  const profile = await requireAdmin()
  const [supabase, { timezone }] = await Promise.all([createClient(), getBranding()])
  const now = new Date().toISOString()

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)
  const head = { count: "exact", head: true } as const
  // Knowledge Library sources only (the campus map image lives in Admin › Campus Map).
  const sources = () => supabase.from("documents").select("*", head).neq("document_type", "campus_map")
  const [
    publishedSections, draftSections,
    readySources, failedSources, pendingSources,
    users,
    publishedAnnouncements, draftAnnouncements,
    departments, publishedDepartments, programs,
    buildings, locations, settings,
    recent,
  ] = await Promise.all([
    count(supabase.from("guidelines").select("*", head).eq("status", "published")),
    count(supabase.from("guidelines").select("*", head).eq("status", "draft")),
    count(sources().eq("status", "ready")),
    count(sources().eq("status", "failed")),
    count(sources().in("status", ["uploaded", "processing"])),
    // Regular accounts only; administrators are not counted.
    count(supabase.from("profiles").select("*", head).eq("role", "user")),
    count(supabase.from("announcements").select("*", head).eq("status", "published")),
    count(supabase.from("announcements").select("*", head).eq("status", "draft")),
    count(supabase.from("departments").select("*", head)),
    count(supabase.from("departments").select("*", head).eq("is_published", true)),
    count(supabase.from("programs").select("*", head)),
    count(supabase.from("campus_buildings").select("*", head).eq("is_active", true)),
    count(supabase.from("campus_locations").select("*", head)),
    supabase.from("system_settings").select("campus_map_path, campus_map_updated_at").maybeSingle().then((r) => r.data),
    Promise.all([
      supabase.from("announcements").select("id, title, status, created_at, updated_at").order("updated_at", { ascending: false }).limit(5),
      supabase.from("documents").select("id, title, status, created_at, updated_at").neq("document_type", "campus_map").order("updated_at", { ascending: false }).limit(5),
      supabase.from("guidelines").select("id, title, created_at, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(5),
      supabase.from("departments").select("id, name, is_published, created_at, updated_at").order("updated_at", { ascending: false }).limit(5),
      supabase.from("campus_buildings").select("id, building_number, name, created_at, updated_at").order("updated_at", { ascending: false }).limit(5),
    ]),
  ])

  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "Admin"

  const metrics: { label: string; value: number; note: string; href: string; icon: LucideIcon }[] = [
    { label: "Published Knowledge", value: publishedSections, note: "Available to Campus Agent", href: "/admin/knowledge", icon: Library },
    { label: "Ready Sources", value: readySources, note: "Processed and available", href: "/admin/knowledge", icon: FileText },
    { label: "Users", value: users, note: "Registered accounts", href: "/admin/users", icon: Users },
    { label: "Published Announcements", value: publishedAnnouncements, note: "University-wide notices", href: "/admin/announcements?tab=published", icon: Megaphone },
  ]

  // ---------- System readiness (from real records) ----------
  const hasMap = Boolean(settings?.campus_map_path)
  const readiness: Readiness[] = [
    {
      label: "Knowledge Library",
      status: publishedSections > 0 ? "ready" : "review",
      detail: publishedSections > 0 ? `${plural(publishedSections, "published section")}` : "No published sections yet",
      note: draftSections > 0 ? `${plural(draftSections, "draft")} to review` : undefined,
      href: "/admin/knowledge",
      icon: Library,
    },
    {
      label: "Sources",
      status: failedSources > 0 ? "failed" : pendingSources > 0 || readySources === 0 ? "review" : "ready",
      detail: readySources > 0 ? `${readySources} ready` : "No processed sources yet",
      note: [failedSources && `${failedSources} failed`, pendingSources && `${pendingSources} processing`].filter(Boolean).join(" · ") || undefined,
      href: "/admin/knowledge",
      icon: FileText,
    },
    {
      label: "Departments",
      status: publishedDepartments > 0 ? "ready" : "review",
      detail: departments > 0 ? `${plural(departments, "department")} · ${plural(programs, "program")}` : "No departments yet",
      note: departments > 0 && publishedDepartments === 0 ? "None published" : undefined,
      href: "/admin/departments",
      icon: Building2,
    },
    {
      label: "Campus Map",
      status: hasMap && buildings > 0 ? "ready" : "review",
      detail: [hasMap ? "Map image" : "No map image", plural(buildings, "building"), plural(locations, "location")].join(" · "),
      href: "/admin/campus-map",
      icon: MapIcon,
    },
    {
      label: "Announcements",
      status: "ready",
      detail: `${publishedAnnouncements} published`,
      note: draftAnnouncements > 0 ? `${plural(draftAnnouncements, "draft")} waiting` : undefined,
      href: draftAnnouncements > 0 ? "/admin/announcements?tab=draft" : "/admin/announcements",
      icon: Megaphone,
    },
  ]
  const allReady = readiness.every((r) => r.status === "ready" && !r.note)

  // ---------- Recent updates (latest 5 across records) ----------
  const [announcementRows, sourceRows, sectionRows, departmentRows, buildingRows] = recent
  const updates: Update[] = [
    ...(announcementRows.data ?? []).map((a) => ({
      at: a.updated_at,
      action: wasUpdated(a) ? "Announcement updated" : a.status === "published" ? "Announcement published" : "Announcement created",
      title: a.title, href: `/admin/announcements/${a.id}`, status: { tone: a.status },
    })),
    ...(sourceRows.data ?? []).map((d) => ({
      at: d.updated_at, action: wasUpdated(d) ? "Knowledge source updated" : "Knowledge source added",
      title: d.title, href: `/admin/documents/${d.id}`, status: describeStatus(d.status),
    })),
    ...(sectionRows.data ?? []).map((g) => ({
      at: g.updated_at, action: "Knowledge section published", title: g.title, href: `/admin/knowledge/${g.id}`,
    })),
    ...(departmentRows.data ?? []).map((d) => ({
      at: d.updated_at, action: wasUpdated(d) ? "Department updated" : "Department created",
      title: d.name, href: "/admin/departments", status: d.is_published ? undefined : { tone: "draft" },
    })),
    ...(buildingRows.data ?? []).map((b) => ({
      at: b.updated_at, action: wasUpdated(b) ? "Campus location updated" : "Campus location added",
      title: `Building ${b.building_number} — ${b.name}`, href: "/admin/campus-map",
    })),
    ...(settings?.campus_map_updated_at ? [{ at: settings.campus_map_updated_at, action: "Campus map updated", title: "Campus map image", href: "/admin/campus-map" }] : []),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)

  const sectionHeader = "border-b px-5 py-3.5"

  return (
    <div data-layout="dashboard" className="w-full min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting(now, timezone)},</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--ink)]">Welcome back, {firstName}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s an overview of your Campus Agent system.</p>
        </div>
        <DashboardClock initialIso={now} timezone={timezone} />
      </header>

      <section aria-label="System overview" className="mt-5">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, note, href, icon: Icon }) => (
            <li key={label} className="min-w-0">
              <Link href={href} className="flex h-full flex-col rounded-lg border bg-background px-4 py-3.5 transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">{label}</span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</span>
                <span className="mt-2 truncate text-xs text-muted-foreground">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="readiness-heading" className="mt-5 overflow-hidden rounded-lg border bg-background">
        <div className={sectionHeader}>
          <h2 id="readiness-heading" className="font-semibold">System readiness</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Key content and configuration Campus Agent depends on.</p>
        </div>
        {allReady && (
          <p className="flex items-center gap-2 border-b bg-[var(--success-surface)] px-5 py-2.5 text-sm font-medium text-[var(--success)]">
            <CircleCheck className="size-4" aria-hidden="true" />
            Campus Agent is ready.
          </p>
        )}
        <ul className="divide-y">
          {readiness.map(({ label, status, detail, note, href, icon: Icon }) => (
            <li key={label}>
              <Link href={href} className="flex items-center gap-3 px-5 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {detail}
                    {note && <span className={status === "failed" ? "text-destructive" : "text-[var(--attention)]"}> · {note}</span>}
                  </span>
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
                    status === "ready" ? "text-[var(--success)]" : status === "failed" ? "text-destructive" : "text-[var(--attention)]"
                  )}
                >
                  {status === "ready" ? <CircleCheck className="size-3.5" aria-hidden="true" /> : status === "failed" ? <TriangleAlert className="size-3.5" aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
                  {status === "ready" ? "Ready" : status === "failed" ? "Failed" : "Review"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="updates-heading" className="mt-5 overflow-hidden rounded-lg border bg-background">
        <div className={sectionHeader}>
          <h2 id="updates-heading" className="font-semibold">Recent updates</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Latest changes across Campus Agent.</p>
        </div>
        {updates.length > 0 ? (
          <ul className="divide-y">
            {updates.map((u) => (
              // [ flexible: action + title ] [ fixed: status ] [ fixed, right-aligned: date/time ].
              // Below sm the status and date wrap under the title.
              <li key={`${u.action}-${u.href}-${u.at}`} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">{u.action}</span>
                  <Link href={u.href} className="block truncate text-sm font-medium hover:text-primary hover:underline">{u.title}</Link>
                </span>
                <span className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
                  <span className="sm:flex sm:w-24 sm:justify-start">
                    {u.status && <StatusBadge status={u.status.tone} label={u.status.label} />}
                  </span>
                  <time dateTime={u.at} className="text-xs text-muted-foreground tabular-nums sm:w-40 sm:text-right">
                    {formatDate(u.at, timezone, { month: "short", day: "numeric", year: "numeric" })} · {formatTime(u.at, timezone)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No updates yet.</p>
        )}
      </section>
    </div>
  )
}
