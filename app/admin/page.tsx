import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  FileText,
  FileUp,
  KeyRound,
  Library,
  Megaphone,
  TriangleAlert,
  UserPlus,
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

const DAY_MS = 24 * 60 * 60 * 1000

function greeting(iso: string, timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(iso)))
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

type Activity = { at: string; type: string; details: string; href: string; status?: { tone: string; label?: string } }

export default async function AdminDashboardPage() {
  const profile = await requireAdmin()
  // Branding loads alongside the client instead of before the dashboard queries.
  const [supabase, { timezone }] = await Promise.all([createClient(), getBranding()])
  const now = new Date().toISOString()
  const weekAhead = new Date(new Date(now).getTime() + 7 * DAY_MS).toISOString()

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)
  const head = { count: "exact", head: true } as const
  const [
    publishedGuides,
    readySources,
    students,
    upcomingEvents,
    draftGuides,
    failedSources,
    pendingSources,
    temporaryPasswords,
    recent,
  ] = await Promise.all([
    count(supabase.from("guidelines").select("*", head).eq("status", "published")),
    count(supabase.from("documents").select("*", head).eq("status", "ready")),
    count(supabase.from("profiles").select("*", head).eq("role", "student")),
    count(supabase.from("events").select("*", head).eq("status", "published").gte("starts_at", now).lt("starts_at", weekAhead)),
    count(supabase.from("guidelines").select("*", head).eq("status", "draft")),
    count(supabase.from("documents").select("*", head).eq("status", "failed")),
    count(supabase.from("documents").select("*", head).in("status", ["uploaded", "processing"])),
    count(supabase.from("profiles").select("*", head).eq("role", "student").eq("must_change_password", true)),
    // Latest records by creation time. There is no audit log, so this shows what was
    // created and its current status — not who did it.
    Promise.all([
      supabase.from("profiles").select("id, full_name, email, created_at").eq("role", "student").order("created_at", { ascending: false }).limit(5),
      supabase.from("documents").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("guidelines").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("events").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("announcements").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(5),
    ]),
  ])

  const [studentRows, sourceRows, guideRows, eventRows, announcementRows] = recent
  const activity: Activity[] = [
    ...(studentRows.data ?? []).map((s) => ({
      at: s.created_at, type: "Student account created", details: s.full_name ?? s.email ?? "Student", href: `/admin/users/${s.id}`,
    })),
    ...(sourceRows.data ?? []).map((d) => ({
      at: d.created_at, type: "Source uploaded", details: d.title, href: `/admin/documents/${d.id}`, status: describeStatus(d.status),
    })),
    ...(guideRows.data ?? []).map((g) => ({
      at: g.created_at, type: "Knowledge section created", details: g.title, href: `/admin/knowledge/${g.id}`, status: { tone: g.status },
    })),
    ...(eventRows.data ?? []).map((e) => ({
      at: e.created_at, type: "Event created", details: e.title, href: `/admin/events/${e.id}`, status: { tone: e.status },
    })),
    ...(announcementRows.data ?? []).map((a) => ({
      at: a.created_at, type: "Announcement created", details: a.title, href: `/admin/announcements/${a.id}`, status: { tone: a.status },
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)

  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "Admin"

  const metrics: { label: string; value: number; note: string; href: string; icon: LucideIcon }[] = [
    { label: "Published Knowledge", value: publishedGuides, note: "Used by Campus Agent", href: "/admin/knowledge?tab=published", icon: Library },
    { label: "Ready Sources", value: readySources, note: "Processed and available", href: "/admin/knowledge?tab=pdf", icon: FileText },
    { label: "Student Accounts", value: students, note: "Provisioned by admins", href: "/admin/users", icon: Users },
    { label: "Upcoming Events", value: upcomingEvents, note: "Published, next 7 days", href: "/admin/events", icon: CalendarDays },
  ]

  const actions: { label: string; detail: string; count: number; clear: string; tone: "attention" | "error"; href: string; icon: LucideIcon }[] = [
    {
      label: "Draft sections awaiting review",
      detail: "Review and publish them so students can see them.",
      count: draftGuides,
      clear: "No draft sections waiting",
      tone: "attention",
      href: "/admin/knowledge?tab=draft",
      icon: Library,
    },
    {
      label: failedSources > 0 ? "Sources that failed or are still processing" : "Sources still processing",
      detail: [failedSources && `${failedSources} failed`, pendingSources && `${pendingSources} processing`].filter(Boolean).join(" · ") || "",
      count: failedSources + pendingSources,
      clear: "All sources processed",
      tone: failedSources > 0 ? "error" : "attention",
      href: "/admin/knowledge?tab=pdf",
      icon: FileText,
    },
    {
      label: "Students with temporary passwords",
      detail: "They haven't signed in and set their own password yet.",
      count: temporaryPasswords,
      clear: "No temporary passwords outstanding",
      tone: "attention",
      href: "/admin/users",
      icon: KeyRound,
    },
  ]
  const open = actions.filter((a) => a.count > 0)
  const resolved = actions.filter((a) => a.count === 0)

  const quickActions: { label: string; detail: string; href: string; icon: LucideIcon }[] = [
    { label: "Add Student", detail: "Create an account with a temporary password", href: "/admin/users/new", icon: UserPlus },
    { label: "Upload Source", detail: "Add a handbook, policy or campus map", href: "/admin/knowledge?upload=1", icon: FileUp },
    { label: "New Event", detail: "University-wide or for one college", href: "/admin/events/new", icon: CalendarPlus },
    { label: "New Announcement", detail: "Post a notice for students", href: "/admin/announcements/new", icon: Megaphone },
  ]

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting(now, timezone)},</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--ink)]">Welcome back, {firstName}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s an overview of your Campus Agent system.</p>
        </div>
        <DashboardClock initialIso={now} timezone={timezone} />
      </header>

      <section aria-label="Summary" className="mt-5">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, note, href, icon: Icon }) => (
            <li key={label} className="min-w-0">
              <Link
                href={href}
                className="flex h-full flex-col rounded-lg border bg-background px-4 py-3.5 transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
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

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="action-center-heading" className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h2 id="action-center-heading" className="font-semibold">Action Center</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Items that need your attention.</p>
          </div>
          <ul className="divide-y">
            {open.map(({ label, detail, count: n, tone, href, icon: Icon }) => (
              <li key={label}>
                <Link href={href} className="flex items-center gap-4 px-5 py-4 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md border",
                      tone === "error"
                        ? "border-destructive/25 bg-destructive/8 text-destructive"
                        : "border-[var(--attention-border)] bg-[var(--attention-surface)] text-[var(--attention)]"
                    )}
                  >
                    {tone === "error" ? <TriangleAlert className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
                  </span>
                  <span className="text-xl font-semibold tabular-nums">{n}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
            {resolved.length > 0 && (
              <li className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-4">
                {open.length === 0 && <p className="w-full text-sm font-medium">You&apos;re all caught up.</p>}
                {resolved.map((a) => (
                  <span key={a.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleCheck className="size-3.5 text-[var(--success)]" aria-hidden="true" />
                    {a.clear}
                  </span>
                ))}
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="quick-actions-heading" className="rounded-lg border bg-background">
          <h2 id="quick-actions-heading" className="border-b px-5 py-4 font-semibold">Quick Actions</h2>
          <ul className="divide-y">
            {quickActions.map(({ label, detail, href, icon: Icon }) => (
              <li key={label}>
                <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="activity-heading" className="mt-5 overflow-hidden rounded-lg border bg-background">
        <div className="border-b px-5 py-4">
          <h2 id="activity-heading" className="font-semibold">Recent Activity</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">The latest records added across Campus Agent.</p>
        </div>
        {activity.length > 0 ? (
          <div role="region" aria-label="Recent activity table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date &amp; Time</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activity.map((a) => (
                  <tr key={`${a.type}-${a.href}`}>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatDate(a.at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                      <span className="block text-xs text-muted-foreground">{formatTime(a.at, timezone)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.type}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={a.href} className="font-medium hover:text-primary hover:underline">{a.details}</Link>
                        {a.status && <StatusBadge status={a.status.tone} label={a.status.label} />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No activity yet.</p>
        )}
      </section>
    </>
  )
}
