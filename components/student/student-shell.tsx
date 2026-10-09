"use client"

import {
  BookOpen,
  Building2,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  SquarePen,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { SignOutDialog } from "@/components/auth/sign-out-dialog"
import { Logo } from "@/components/shared/logo"
import { ConversationActions } from "@/components/student/conversation-actions"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "cn"

// Campus information, read-only views of what admins publish. Offices is not listed:
// location questions are answered from the campus map, and /app/offices remains available.
const NAV = [
  { href: "/app/guides", label: "School Guides", icon: BookOpen },
  { href: "/app/departments", label: "Departments", icon: Building2 },
  { href: "/app/map", label: "Campus Map", icon: MapIcon },
  { href: "/app/announcements", label: "Announcements", icon: Megaphone },
]

/** Display name (or email), and the email or "Account" as the second line. */
type ShellUser = { name: string; detail: string }
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
  // Hidden right away on delete, before the revalidated list arrives. Server order is kept.
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const recent = recentConversations.filter((c) => !deletedIds.includes(c.id))
  const onDeleted = (id: string) => setDeletedIds((ids) => [...ids, id])

  return (
    <div className="student-shell flex min-h-dvh flex-1 lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-background text-foreground lg:flex">
        <SidebarContent assistantName={assistantName} user={user} recent={recent} onDeleted={onDeleted} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-2 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[18rem] max-w-[calc(100vw-2rem)] gap-0 bg-background p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent
                assistantName={assistantName}
                user={user}
                recent={recent}
                onDeleted={onDeleted}
                onNavigate={() => setMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Link href="/app" aria-label={`${assistantName} home`} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo alt="" priority className="h-6 w-auto" />
          </Link>
          <Link
            href="/app"
            aria-label="New conversation"
            className="inline-flex size-10 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SquarePen className="size-5" aria-hidden="true" />
          </Link>
        </header>

        <main className="flex flex-1 flex-col bg-[var(--canvas)]">{children}</main>
      </div>
    </div>
  )
}

function SidebarContent({
  assistantName,
  user,
  recent,
  onDeleted,
  onNavigate,
}: {
  assistantName: string
  user: ShellUser
  recent: ShellConversation[]
  onDeleted: (id: string) => void
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
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link
          href="/app"
          onClick={onNavigate}
          aria-label={`${assistantName} home`}
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo alt="" priority className="h-6 w-auto" />
        </Link>
      </div>

      <div className="px-3 pt-1">
        {/* An action, not a navigation item: white with a border, never the filled active
            background. On /app itself it only gets a slightly stronger border. */}
        <Link
          href="/app"
          onClick={onNavigate}
          aria-current={pathname === "/app" ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-semibold text-foreground shadow-xs transition-colors outline-none hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50",
            pathname === "/app" ? "border-primary/40" : "border-border"
          )}
        >
          <SquarePen className="size-4 text-primary" aria-hidden="true" />
          New conversation
        </Link>
      </div>

      <nav aria-labelledby="campus-nav-heading" className="mt-5 px-3">
        <h2 id="campus-nav-heading" className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Campus information
        </h2>
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
                    "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <section aria-labelledby="recent-heading" className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <h2 id="recent-heading" className="px-3 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Recent conversations
        </h2>
        {recent.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-0.5">
            {recent.map((c) => {
              const href = `/app/chat/${c.id}`
              const active = pathname === href
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={c.title}
                    className={cn(
                      "block truncate rounded-md py-1.5 pr-9 pl-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-foreground/80 group-hover:bg-muted group-hover:text-foreground"
                    )}
                  >
                    {c.title}
                  </Link>
                  <ConversationActions conversation={c} onDeleted={onDeleted} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 px-3 text-sm text-muted-foreground">No conversations yet.</p>
        )}
      </section>

      {/* Account footer, one row: [avatar] [name / email] [sign out]. The name links to the profile. */}
      <div className="shrink-0 border-t px-3 py-1.5">
        <div className="flex h-11 items-center gap-2.5 rounded-md pr-1 pl-1.5 transition-colors hover:bg-muted/50">
          <Link
            href="/app/profile"
            onClick={onNavigate}
            aria-current={pathname === "/app/profile" ? "page" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              aria-hidden="true"
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full border bg-muted text-[0.6875rem] font-semibold text-muted-foreground"
            >
              {initials || "?"}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground" title={user.detail}>{user.detail}</span>
            </span>
          </Link>
          <SignOutDialog
            appName={assistantName}
            trigger={
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
