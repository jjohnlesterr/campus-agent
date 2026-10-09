"use client"

import { cn } from "cn"
import { useState } from "react"

import { ImageLightbox } from "@/components/shared/image-lightbox"

/**
 * The department logo under the cover banner. With a logo, clicking it opens the shared
 * lightbox with the whole original logo (no expand icon, just a pointer and hover/focus).
 * Without one, the short name stands in.
 */
export function DepartmentLogo({ src, name, shortName }: { src: string | null; name: string; shortName: string }) {
  const [open, setOpen] = useState(false)
  const box = "relative -mt-5 ml-3 flex size-14 items-center justify-center overflow-hidden rounded-xl border bg-background shadow-sm sm:-mt-6 sm:ml-0 sm:size-16"

  if (!src) {
    return (
      <span className={box}>
        <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">{shortName.slice(0, 4)}</span>
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View department logo"
        title="View department logo"
        className={cn(box, "cursor-pointer transition-[border-color,box-shadow] outline-none hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- public storage URL */}
        <img src={src} alt={`${name} logo`} className="size-full object-contain p-1.5" />
      </button>
      <ImageLightbox src={src} alt={`${name} logo`} open={open} onOpenChange={setOpen} />
    </>
  )
}
