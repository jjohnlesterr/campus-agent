"use client"

import { Menu } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "cn"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function AdminShell({ assistantName, userName, children }: {
  assistantName: string
  userName: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false) }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  return (
    <div className="admin-shell flex min-h-dvh min-w-0 flex-1 bg-[var(--canvas)]">
      <a href="#admin-content" className="sr-only z-50 rounded-md bg-background p-3 text-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 lg:block", collapsed ? "w-[4.5rem]" : "w-60")}>
        <AdminSidebar assistantName={assistantName} userName={userName} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger aria-label="Open admin navigation" className="inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" showCloseButton={false} className="data-[side=left]:w-72 max-w-[calc(100vw-2rem)] gap-0 border-0 bg-background p-0 motion-reduce:transition-none">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <AdminSidebar assistantName={assistantName} userName={userName} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/admin" aria-label={`${assistantName} administration home`} className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Image src="/assets/logo.png" width={2060} height={344} alt="" priority className="h-6 w-auto" />
            <span className="text-xs font-medium text-muted-foreground">Admin</span>
          </Link>
        </header>
        <main id="admin-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <div className="admin-content mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
