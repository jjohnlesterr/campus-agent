"use client"

import { CalendarDays, FileText, LayoutDashboard, Library, LogOut, Map as MapIcon, Megaphone, PanelLeftClose, PanelLeftOpen, Settings, Users, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { SignOutDialog } from "@/components/auth/sign-out-dialog"
import { Logo, LogoMark } from "@/components/shared/logo"

const NAV_GROUPS = [
  { id: "overview", label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    id: "content",
    label: "Content",
    items: [
      { href: "/admin/knowledge", label: "Knowledge Base", icon: Library },
      { href: "/admin/documents", label: "Sources", icon: FileText },
    ],
  },
  {
    id: "campus",
    label: "Campus Information",
    items: [
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/locations", label: "Campus Map", icon: MapIcon },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
]

const controlClass = "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"

export function AdminSidebar({ assistantName, userName, collapsed = false, onToggle, onNavigate }: {
  assistantName: string
  userName: string
  collapsed?: boolean
  onToggle?: () => void
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-col border-r bg-background text-foreground">
      <div className={cn("flex shrink-0 border-b", collapsed ? "flex-col items-center gap-2 px-2 py-3" : "min-h-16 items-center gap-2 px-4")}>
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label={`${assistantName} administration home`}
          className={cn("rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", !collapsed && "min-w-0 flex-1")}
        >
          {collapsed ? (
            <LogoMark size={32} priority />
          ) : (
            <span className="flex flex-col gap-1">
              <Logo alt="" priority className="h-6 w-auto max-w-full self-start" />
              <span className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">Administration</span>
            </span>
          )}
        </Link>
        {onToggle && (
          <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="admin-desktop-navigation" className={controlClass}>
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </button>
        )}
        {onNavigate && (
          <button type="button" onClick={onNavigate} aria-label="Close navigation" className={controlClass}>
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <nav id={onToggle ? "admin-desktop-navigation" : undefined} aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
        <div className={cn("flex flex-col", collapsed ? "gap-3" : "gap-5")}>
          {NAV_GROUPS.map((group) => {
            // Mobile and desktop sidebars can both be in the DOM; keep label ids unique.
            const labelId = `admin-nav-${group.id}${onToggle ? "" : "-mobile"}`
            return (
              <div key={group.id}>
                <p id={labelId} className={collapsed ? "sr-only" : "mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase"}>
                  {group.label}
                </p>
                <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
                    return (
                      <li key={href}>
                        <Link href={href} onClick={onNavigate} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={cn(
                          "flex min-h-9 items-center gap-3 rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          collapsed ? "justify-center px-2" : "px-3",
                          active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}>
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          <span className={collapsed ? "sr-only" : ""}>{label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </nav>
      <div className={cn("flex shrink-0 items-center border-t py-3", collapsed ? "flex-col gap-2 px-2" : "gap-3 px-4")}>
        <span aria-hidden="true" title={collapsed ? userName : undefined} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {userName.trim().charAt(0).toUpperCase() || "A"}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={userName}>{userName}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        )}
        <SignOutDialog
          appName={assistantName}
          trigger={
            <button type="button" aria-label="Sign out" title="Sign out" className={controlClass}>
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </div>
  )
}
