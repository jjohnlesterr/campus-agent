"use client"

import {
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Library,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Settings,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { logout } from "@/app/(auth)/actions"
import { Wordmark } from "@/components/shared/wordmark"
import { cn } from "cn"

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/knowledge", label: "Knowledge Base", icon: Library },
  { href: "/admin/documents", label: "Sources", icon: FileText },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/offices", label: "Offices", icon: Building2 },
  { href: "/admin/locations", label: "Campus Map", icon: MapIcon },
]

export function AdminSidebar({
  assistantName,
  userName,
}: {
  assistantName: string
  userName: string
}) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)

  const itemClass = (active: boolean) =>
    cn(
      "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/60",
      active
        ? "bg-white/12 font-medium text-ink-foreground"
        : "text-ink-muted hover:bg-white/6 hover:text-ink-foreground"
    )

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col bg-ink text-ink-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <Wordmark name={assistantName} tone="inverse" className="text-[0.95rem]" />
        <span className="rounded border border-white/20 px-1.5 py-px text-[0.68rem] font-medium tracking-wide text-ink-muted">
          Admin
        </span>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-2 py-3">
        <Link
          href="/admin/settings"
          aria-current={isActive("/admin/settings") ? "page" : undefined}
          className={itemClass(isActive("/admin/settings"))}
        >
          <Settings className="size-4 shrink-0" aria-hidden="true" />
          Settings
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2 px-3">
          <span className="truncate text-xs text-ink-muted">{userName}</span>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors outline-none hover:bg-white/8 hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-ink-foreground/60"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
