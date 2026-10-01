"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Logo as LandingLogo } from "@/components/shared/logo"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#sources", label: "Verified sources" },
  { href: "#about", label: "About" },
]


// Accounts are provisioned by administrators: "Sign in" is the only auth action.
export function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Campus Agent home" className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <LandingLogo className="h-6 w-auto sm:h-7" priority />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                {l.label}
              </a>
            ))}
          </nav>
          <Link href="/login" className={buttonVariants({ size: "lg", className: "px-4" })}>
            Sign in
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger aria-label="Open menu" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden">
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 max-w-[calc(100vw-2rem)] gap-0 p-0">
              <SheetTitle className="border-b px-5 py-4">
                <LandingLogo className="h-6 w-auto" />
                <span className="sr-only">Menu</span>
              </SheetTitle>
              <nav aria-label="Main" className="flex flex-col p-3">
                {LINKS.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                    {l.label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
