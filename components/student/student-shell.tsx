"use client"

import {
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  SquarePen,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { logout } from "@/app/(auth)/actions"
import { Wordmark } from "@/components/shared/wordmark"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "cn"

const NAV = [
  { href: "/app/guides", label: "School Guides", icon: BookOpen },
  { href: "/app/offices", label: "Offices", icon: Building2 },
  { href: "/app/events", label: "Events", icon: CalendarDays },
  { href: "/app/announcements", label: "Announcements", icon: Megaphone },
  { href: "/app/map", label: "Campus Map", icon: MapIcon },
  { href: "/app/how-it-works", label: "How It Works", icon: CircleHelp },
]

type ShellUser = { name: string; detail: string | null }
type ShellConversation = { id: string; title: string }

export function StudentShell({
  assistantName,
  user,
  recentConversations,
  children,
}: {
  assistantName: string
  user: ShellUser
  recentConversations: ShellConversation[]
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-1 lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent assistantName={assistantName} user={user} recent={recentConversations} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-2 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[18rem] gap-0 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent
                assistantName={assistantName}
                user={user}
                recent={recentConversations}
                onNavigate={() => setMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Link href="/app" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Wordmark name={assistantName} className="text-[0.95rem]" />
          </Link>
          <Link
            href="/app"
            aria-label="New conversation"
            className="inline-flex size-10 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SquarePen className="size-5" aria-hidden="true" />
          </Link>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  )
}

function SidebarContent({
  assistantName,
  user,
  recent,
  onNavigate,
}: {
  assistantName: string
  user: ShellUser
  recent: ShellConversation[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link
          href="/app"
          onClick={onNavigate}
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Wordmark name={assistantName} className="text-[0.95rem]" />
        </Link>
      </div>

      <div className="px-3 pt-1">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium shadow-[0_1px_2px_oklch(0.22_0.025_262/0.06)] transition-colors outline-none hover:border-ring/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <SquarePen className="size-4 text-primary" aria-hidden="true" />
          New conversation
        </Link>
      </div>

      <nav aria-label="Student" className="mt-4 px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon
                    className={cn("size-4", active ? "text-primary" : "text-muted-foreground")}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <section aria-labelledby="recent-heading" className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        <h2 id="recent-heading" className="px-3 text-xs font-medium text-muted-foreground">
          Recent conversations
        </h2>
        {recent.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-0.5">
            {recent.map((c) => {
              const href = `/app/chat/${c.id}`
              const active = pathname === href
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={c.title}
                    className={cn(
                      "block truncate rounded-lg px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                    )}
                  >
                    {c.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 px-3 text-sm text-muted-foreground/90">
            No conversations yet. Your questions will appear here.
          </p>
        )}
      </section>

      <div className="flex shrink-0 items-center gap-2 border-t p-3">
        <Link
          href="/app/profile"
          onClick={onNavigate}
          aria-current={pathname === "/app/profile" ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials || "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            {user.detail && (
              <span className="block truncate text-xs text-muted-foreground">{user.detail}</span>
            )}
          </span>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  )
}
