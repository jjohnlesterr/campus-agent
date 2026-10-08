"use client"

import { cn } from "cn"
import { Menu } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { Logo as LandingLogo } from "@/components/shared/logo"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { pressMotion } from "@/lib/motion"

// Section links on the landing page (smooth-scrolled, see globals.css). "/#…" so they
// also lead back to the landing page from other public pages. School Guides live in
// the signed-in app. There is no admin sign-in option here.
const LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#sources", label: "Sources" },
  { href: "/#about", label: "About" },
]

const SECTION_IDS = LINKS.map((l) => l.href.slice(2))

const GUEST_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Create account" },
]

/**
 * The landing-page section the reader is on, or null (hero, or another page).
 * An activation line sits just below the sticky header; the current section is the last
 * one whose top has scrolled past it, so a sliver of the previous section still on screen
 * doesn't keep it active. At the bottom of the page the last section wins, since a short
 * final section may never scroll its top up to the line.
 */
function useCurrentSection(headerRef: React.RefObject<HTMLElement | null>) {
  const [current, setCurrent] = useState<string | null>(null)
  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter((el) => el !== null)
    if (sections.length === 0) return
    let frame = 0
    const update = () => {
      frame = 0
      // Nav clicks land a section's top at scroll-mt-20 (80px); the line must sit below that.
      const line = (headerRef.current?.getBoundingClientRect().bottom ?? 64) + 24
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      const active = atBottom
        ? sections[sections.length - 1]
        : sections.findLast((section) => section.getBoundingClientRect().top <= line)
      setCurrent(active?.id ?? null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [headerRef])
  return current
}

/**
 * account: the signed-in user's home ("/app" or "/admin") and profile page, or null
 * for a guest. Guests see Sign in + Create account; signed-in users see Open Campus Agent.
 */
export function LandingNav({ account }: { account: { homeHref: string; profileHref: string | null } | null }) {
  const [open, setOpen] = useState(false)
  // Section the mobile menu should scroll to once it has closed (its scroll lock is released).
  const pendingSection = useRef<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const currentSection = useCurrentSection(headerRef)
  const menuLinks = account
    ? [
        { href: account.homeHref, label: "Open Campus Agent" },
        ...(account.profileHref ? [{ href: account.profileHref, label: "Your profile" }] : []),
      ]
    : GUEST_LINKS

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          aria-label="Campus Agent home"
          onClick={(event) => {
            // Already on the landing page: glide back to the hero (smooth via globals.css) instead of re-navigating.
            if (location.pathname !== "/") return
            event.preventDefault()
            if (location.hash) history.pushState(null, "", "/")
            window.scrollTo({ top: 0 })
          }}
          className="shrink-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <LandingLogo className="h-6 w-auto sm:h-7" priority />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Main" className="hidden items-center gap-1 md:mr-3 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={currentSection === l.href.slice(2) ? "true" : undefined}
                className={cn(
                  "relative cursor-pointer rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:text-foreground",
                  // Thin underline that draws in from the left on hover and stays under the current section.
                  "after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 aria-[current=true]:after:scale-x-100 motion-reduce:after:transition-none",
                )}
              >
                {l.label}
              </a>
            ))}
          </nav>
          {account ? (
            <>
              {account.profileHref && (
                <Link href={account.profileHref} className={buttonVariants({ variant: "ghost", size: "lg", className: "hidden px-3 sm:inline-flex" })}>
                  Profile
                </Link>
              )}
              {/* Short label on phones so the header never overflows at 360px. */}
              <Link href={account.homeHref} className={buttonVariants({ size: "lg", className: "px-3 sm:px-4" })}>
                <span className="sm:hidden">Open app</span>
                <span className="hidden sm:inline">Open Campus Agent</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  // The theme border token is too faint on the white header; use a visible blue-gray edge.
                  "hidden border-primary/30 bg-white px-4 text-foreground hover:border-primary/45 hover:bg-accent hover:text-foreground sm:inline-flex",
                  pressMotion,
                )}
              >
                Sign in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-3 sm:px-4", pressMotion)}>
                Create account
              </Link>
            </>
          )}
          <Sheet
            open={open}
            onOpenChange={setOpen}
            onOpenChangeComplete={(isOpen) => {
              const id = pendingSection.current
              pendingSection.current = null
              if (isOpen || !id) return
              history.pushState(null, "", `#${id}`)
              document.getElementById(id)?.scrollIntoView()
            }}
          >
            <SheetTrigger aria-label="Open menu" className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden">
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 max-w-[calc(100vw-2rem)] gap-0 p-0">
              <SheetTitle className="border-b px-5 py-4">
                <LandingLogo className="h-6 w-auto" />
                <span className="sr-only">Menu</span>
              </SheetTitle>
              <nav aria-label="Main" className="flex flex-col p-3">
                {[...LINKS, ...menuLinks].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    aria-current={currentSection === l.href.slice(2) ? "true" : undefined}
                    onClick={(event) => {
                      // Same-page section: wait for the menu to close, then scroll there.
                      if (l.href.startsWith("/#") && location.pathname === "/") {
                        event.preventDefault()
                        pendingSection.current = l.href.slice(2)
                      }
                      setOpen(false)
                    }}
                    className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted aria-[current=true]:text-primary"
                  >
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
