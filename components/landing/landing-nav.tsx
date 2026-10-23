"use client"

import { cn } from "cn"
import { ArrowRight, Menu } from "lucide-react"
import Image from "next/image"
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
      // Keep the activation line below the header and the section scroll offset.
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
 * account: the signed-in user's home ("/app" or "/admin"), or null for a guest.
 * Guests see Sign in + Create account; signed-in users see Open Campus Agent.
 */
export function LandingNav({ account, floating = false }: { account: { homeHref: string } | null; floating?: boolean }) {
  const [open, setOpen] = useState(false)
  // Section the mobile menu should scroll to once it has closed (its scroll lock is released).
  const pendingSection = useRef<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const currentSection = useCurrentSection(headerRef)
  const menuLinks = account ? [{ href: account.homeHref, label: "Open Campus Agent" }] : GUEST_LINKS

  return (
    <header ref={headerRef} className={cn(
      "sticky z-30",
      floating
        ? "top-3 mx-auto mt-3 mb-3 w-[calc(100%-1.5rem)] max-w-6xl sm:top-4 sm:mt-4 sm:mb-4 sm:w-[calc(100%-3rem)]"
        : "top-0 border-b bg-background",
    )}>
      <div className={cn(
        "mx-auto flex items-center justify-between",
        floating
          ? "h-16 gap-1.5 rounded-2xl border border-primary/10 bg-white/95 px-2.5 shadow-[0_4px_20px_-6px_oklch(0.24_0.07_264/0.16)] min-[360px]:gap-2 min-[360px]:px-3 sm:h-18 sm:gap-4 sm:px-5"
          : "h-16 max-w-6xl gap-3 px-4 sm:gap-4 sm:px-6",
      )}>
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
          {floating ? (
            <Image
              src="/assets/newlogo.png"
              width={2172}
              height={724}
              alt="Campus Agent"
              sizes="(min-width: 640px) 168px, (min-width: 360px) 144px, 120px"
              preload
              className="h-10 w-30 object-contain min-[360px]:h-12 min-[360px]:w-36 sm:h-14 sm:w-42"
            />
          ) : (
            <LandingLogo className="h-6 w-auto sm:h-7" priority />
          )}
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Main" className={cn("hidden items-center", floating ? "gap-2 lg:mr-5 lg:flex" : "gap-1 md:mr-3 md:flex")}>
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={currentSection === l.href.slice(2) ? "true" : undefined}
                className={cn(
                  "relative cursor-pointer rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  floating ? "font-medium hover:text-primary aria-[current=true]:text-primary" : "hover:text-foreground aria-[current=true]:text-foreground",
                  // Thin underline that draws in from the left on hover and stays under the current section.
                  "after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 aria-[current=true]:after:scale-x-100 motion-reduce:after:transition-none",
                )}
              >
                {l.label}
              </a>
            ))}
          </nav>
          {account ? (
            // Short label on phones so the header never overflows at 360px.
            <Link href={account.homeHref} className={cn(buttonVariants({ size: "lg" }), floating ? "h-10 gap-2 rounded-xl px-2.5 text-xs font-semibold transition-colors duration-200 hover:bg-primary/90 min-[360px]:text-sm sm:h-11 sm:px-4 motion-reduce:transition-none" : "px-3 sm:px-4")}>
              <span className="sm:hidden">Open app</span>
              <span className="hidden sm:inline">Open Campus Agent</span>
              {floating && <ArrowRight className="size-4" aria-hidden="true" />}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  // The theme border token is too faint on the white header; use a visible blue-gray edge.
                  "hidden border-primary/30 bg-white px-4 text-foreground hover:border-primary/45 hover:bg-accent hover:text-foreground sm:inline-flex",
                  floating && "h-11 rounded-xl",
                  pressMotion,
                )}
              >
                Sign in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), floating ? "h-10 rounded-xl px-2.5 text-xs font-semibold hover:bg-primary/90 min-[360px]:text-sm sm:h-11 sm:px-4" : "px-3 sm:px-4", pressMotion)}>
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
            <SheetTrigger aria-label="Open menu" className={cn("inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50", floating ? "lg:hidden" : "md:hidden")}>
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 max-w-[calc(100vw-2rem)] gap-0 p-0">
              <SheetTitle className="border-b px-5 py-4">
                {floating ? (
                  <Image src="/assets/newlogo.png" width={2172} height={724} alt="Campus Agent" sizes="144px" className="h-12 w-36 object-contain" />
                ) : (
                  <LandingLogo className="h-6 w-auto" />
                )}
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
