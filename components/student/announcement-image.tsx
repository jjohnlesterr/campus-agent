"use client"

import { useState } from "react"

import { ImageLightbox } from "@/components/shared/image-lightbox"

/** The announcement's whole image; clicking it opens the shared in-page lightbox (no new tab). */
export function AnnouncementImage({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false)
  const alt = `Image from the announcement “${title}”`
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View full image"
        className="block w-full cursor-zoom-in border-b bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- public storage URL */}
        <img src={src} alt={alt} decoding="async" className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
      </button>
      <ImageLightbox src={src} alt={alt} open={open} onOpenChange={setOpen} />
    </>
  )
}
