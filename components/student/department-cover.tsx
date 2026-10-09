"use client"

import { Maximize2 } from "lucide-react"
import { useState } from "react"

import { ImageLightbox } from "@/components/shared/image-lightbox"

/**
 * The department page's cover banner: fixed height, cropped at the admin's position. The
 * image and the expand button open the same lightbox, which shows the whole original image.
 */
export function DepartmentCover({ src, position, name }: { src: string | null; position: string; name: string }) {
  const [open, setOpen] = useState(false)
  const banner = "relative h-44 overflow-hidden rounded-lg border bg-muted sm:h-60 lg:h-72"
  if (!src) return <div className={banner} />

  return (
    <div className={banner}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label="View full image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- public storage URL */}
        <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View full image"
        title="View full image"
        className="absolute top-3 right-3 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/40 bg-white/80 text-foreground shadow-sm backdrop-blur-sm transition-colors outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Maximize2 className="size-4" aria-hidden="true" />
      </button>
      <ImageLightbox src={src} alt={`${name} cover image`} open={open} onOpenChange={setOpen} />
    </div>
  )
}
