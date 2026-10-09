"use client"

import { Building2, LayoutDashboard, Library, LogOut, Map as MapIcon, Megaphone, PanelLeftClose, PanelLeftOpen, Settings, Users, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { SignOutDialog } from "@/components/auth/sign-out-dialog"
import { Logo, LogoMark } from "@/components/shared/logo"

type NavItem = { href: string; label: string; icon: typeof Library; also?: string[] }

const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  { id: "overview", label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    id: "campus-content",
    label: "Campus Content",
    items: [
      // Source details live under /admin/documents/[id], so they keep this item active.
      { href: "/admin/knowledge", label: "Knowledge Library", icon: Library, also: ["/admin/documents"] },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
      // The old /admin/locations URL redirects here.
      { href: "/admin/campus-map", label: "Campus Map", icon: MapIcon, also: ["/admin/locations"] },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
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

export function AdminSidebar({ assistantName, userName, userEmail, collapsed = false, onToggle, onNavigate }: {
  assistantName: string
  userName: string
  /** Sign-in email, shown under "Administrator". */
  userEmail: string
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
                  {group.items.map(({ href, label, icon: Icon, also = [] }) => {
                    const active = href === "/admin" ? pathname === href : [href, ...also].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
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
      {/* Account footer, one row (~57px): [avatar] [Administrator / email] [sign out], aligned
          with the navigation items (same px-3 gutter). Collapsed: avatar over sign out. */}
      <div className={cn("shrink-0 border-t", collapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "px-3 py-1.5")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "h-11 gap-2.5 rounded-md pr-1 pl-1.5 transition-colors hover:bg-muted/50")}>
          <span
            aria-hidden="true"
            title={collapsed ? userEmail || userName : undefined}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full border bg-muted text-[0.6875rem] font-semibold text-muted-foreground"
          >
            {userName.trim().charAt(0).toUpperCase() || "A"}
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
              <p className="truncate text-sm font-semibold">Administrator</p>
              <p className="truncate text-xs text-muted-foreground" title={userEmail || userName}>{userEmail || userName}</p>
            </div>
          )}
          <SignOutDialog
            appName={assistantName}
            trigger={
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </div>
    </div>
  )
}
