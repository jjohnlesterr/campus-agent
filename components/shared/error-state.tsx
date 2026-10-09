"use client"

import { TriangleAlert } from "lucide-react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"

/**
 * Friendly fallback for an unexpected error in a page (used by the error.tsx boundaries).
 * Never shows the error message or stack: only a short explanation, Try again and a way home.
 */
export function ErrorState({ reset, homeHref, homeLabel }: { reset: () => void; homeHref: string; homeLabel: string }) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <TriangleAlert className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-muted-foreground">This page couldn&apos;t be loaded right now. Check your connection and try again.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>Try again</Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>{homeLabel}</Link>
      </div>
    </div>
  )
}
