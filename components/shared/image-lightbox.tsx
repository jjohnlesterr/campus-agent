"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { Minus, Plus, RotateCcw, X } from "lucide-react"
import { useRef, useState } from "react"

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const STEP = 0.5

/**
 * In-page image viewer: a dark backdrop with the image fitted to the viewport (aspect ratio
 * kept, nothing cut off), zoom in / out / reset (1×–3×), and drag-to-pan when zoomed.
 * Closes on the X, Escape, or a click on the backdrop; zoom and position reset each time.
 * Built on the same Base UI dialog as the app's other dialogs: focus moves in, page
 * scrolling is locked, and focus returns to the trigger when it closes.
 */
export function ImageLightbox({ src, alt, open, onOpenChange }: {
  src: string
  alt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const image = useRef<HTMLImageElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; start: { x: number; y: number } } | null>(null)
  const [dragging, setDragging] = useState(false)

  /** Keeps the zoomed image covering its own box, so it can't be dragged out of view. */
  function clamp(next: { x: number; y: number }, scale: number) {
    const el = image.current
    if (!el || scale <= 1) return { x: 0, y: 0 }
    const maxX = (el.offsetWidth * (scale - 1)) / 2
    const maxY = (el.offsetHeight * (scale - 1)) / 2
    return { x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) }
  }

  function zoomTo(scale: number) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale))
    setZoom(next)
    setOffset((current) => clamp(current, next))
  }

  function change(next: boolean) {
    if (!next) {
      // Start fresh next time.
      setZoom(MIN_ZOOM)
      setOffset({ x: 0, y: 0 })
    }
    onOpenChange(next)
  }

  const zoomed = zoom > MIN_ZOOM
  const control = "inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-white/90 transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"

  return (
    <DialogPrimitive.Root open={open} onOpenChange={change}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Popup
          aria-label={alt}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] motion-reduce:animate-none sm:p-8"
          // The popup fills the screen: a click on its empty area is a click on the backdrop.
          onClick={(event) => { if (event.target === event.currentTarget) change(false) }}
        >
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg bg-black/55 p-1 sm:top-4 sm:right-4">
            <button type="button" className={control} onClick={() => zoomTo(zoom - STEP)} disabled={!zoomed} aria-label="Zoom out" title="Zoom out">
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="w-11 text-center text-xs text-white/80 tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" className={control} onClick={() => zoomTo(zoom + STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <button type="button" className={control} onClick={() => zoomTo(MIN_ZOOM)} disabled={!zoomed} aria-label="Reset zoom" title="Reset zoom">
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/25" />
            <DialogPrimitive.Close className={control} aria-label="Close" title="Close">
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* The image box: fitted to the viewport; zoom and pan move the image inside it. */}
          <div className="max-h-full max-w-full overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element -- the existing map URL */}
            <img
              ref={image}
              src={src}
              alt={alt}
              draggable={false}
              onDoubleClick={() => zoomTo(zoomed ? MIN_ZOOM : 2)}
              onPointerDown={(event) => {
                if (!zoomed) return
                event.currentTarget.setPointerCapture(event.pointerId)
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: offset }
                setDragging(true)
              }}
              onPointerMove={(event) => {
                const d = drag.current
                if (!d || d.id !== event.pointerId) return
                setOffset(clamp({ x: d.start.x + event.clientX - d.x, y: d.start.y + event.clientY - d.y }, zoom))
              }}
              onPointerUp={() => { drag.current = null; setDragging(false) }}
              onPointerCancel={() => { drag.current = null; setDragging(false) }}
              className={cn(
                "block max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] touch-none object-contain select-none sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100vw-4rem)]",
                zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
                !dragging && "transition-transform duration-150 motion-reduce:transition-none"
              )}
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
