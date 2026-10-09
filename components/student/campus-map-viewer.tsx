"use client"

import { Maximize2 } from "lucide-react"
import { useState } from "react"

import { ImageLightbox } from "@/components/shared/image-lightbox"

const ALT = "Official campus map with numbered buildings and legend"

/** The campus map image; the image or "View full size" opens it in an in-page lightbox. */
export function CampusMapViewer({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  return (
    <figure className="overflow-hidden rounded-lg border bg-background">
      <button type="button" onClick={() => setOpen(true)} className="block w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label="View the campus map full size">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
        <img src={src} alt={ALT} className="h-auto w-full" />
      </button>
      <figcaption className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
        Official campus map
        <button type="button" onClick={() => setOpen(true)} className="inline-flex cursor-pointer items-center gap-1 rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          <Maximize2 className="size-3.5" aria-hidden="true" />
          View full size
        </button>
      </figcaption>
      <ImageLightbox src={src} alt={ALT} open={open} onOpenChange={setOpen} />
    </figure>
  )
}
