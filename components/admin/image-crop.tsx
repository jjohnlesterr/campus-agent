"use client"

import { cn } from "cn"
import { useRef, useState } from "react"

/** Where an image sits in its crop window, as CSS object-position percentages. */
export type ImagePosition = { x: number; y: number }
export const CENTER_POSITION: ImagePosition = { x: 50, y: 50 }
export const isCentered = (position: ImagePosition) => position.x === CENTER_POSITION.x && position.y === CENTER_POSITION.y
/** CSS object-position for a saved position. */
export const objectPosition = (position: ImagePosition) => `${position.x}% ${position.y}%`

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value * 10) / 10))

/**
 * An image in a fixed 16:9 crop window (object-cover). Dragging with mouse, pen or touch
 * moves the image behind the window; Arrow keys move it in 5% steps. Only the position
 * (CSS object-position, %) changes; the image file itself is never cropped or modified.
 * Used for department covers and announcement images.
 */
export function ImageCrop({ src, label, position, onChange, disabled, hintId }: {
  src: string
  label: string
  position: ImagePosition
  onChange: (position: ImagePosition) => void
  disabled: boolean
  hintId: string
}) {
  const frame = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; start: ImagePosition; overflow: { x: number; y: number } } | null>(null)
  const [dragging, setDragging] = useState(false)

  /** How far (px) the scaled image extends beyond the window on each axis. */
  function overflow() {
    const box = frame.current?.getBoundingClientRect()
    const img = image.current
    if (!box || !img?.naturalWidth || !img.naturalHeight) return { x: 0, y: 0 }
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight)
    return { x: img.naturalWidth * scale - box.width, y: img.naturalHeight * scale - box.height }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: position, overflow: overflow() }
    setDragging(true)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    // Moving the pointer right moves the image right, which shows more of its left side.
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    onChange({
      x: current.overflow.x > 0 ? clamp(current.start.x - (dx / current.overflow.x) * 100) : current.start.x,
      y: current.overflow.y > 0 ? clamp(current.start.y - (dy / current.overflow.y) * 100) : current.start.y,
    })
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [5, 0], ArrowRight: [-5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }
    const step = steps[event.key]
    if (disabled || !step) return
    event.preventDefault()
    onChange({ x: clamp(position.x + step[0]), y: clamp(position.y + step[1]) })
  }

  return (
    <div
      ref={frame}
      tabIndex={disabled ? -1 : 0}
      role="group"
      aria-label={`${label} position, ${Math.round(position.x)}% across and ${Math.round(position.y)}% down. Drag, or use the arrow keys, to adjust.`}
      aria-describedby={hintId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      className={cn(
        "relative aspect-video w-full touch-none overflow-hidden rounded-lg border bg-muted/50 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local previews and storage URLs */}
      <img
        ref={image}
        src={src}
        alt={`${label} preview`}
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full object-cover"
        style={{ objectPosition: objectPosition(position) }}
      />
    </div>
  )
}
