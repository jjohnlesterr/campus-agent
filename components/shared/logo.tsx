import Image from "next/image"
import { cn } from "cn"

// public/assets/logo.png is a 2060×344 lockup: graduation-cap mark + "Campus Agent".
const SRC = "/assets/logo.png"
const WIDTH = 2060
const HEIGHT = 344

/** Full logo. Size it by height (e.g. "h-7 w-auto"); the aspect ratio is preserved. */
export function Logo({ className = "h-7 w-auto", priority = false, alt = "Campus Agent" }: { className?: string; priority?: boolean; alt?: string }) {
  return <Image src={SRC} width={WIDTH} height={HEIGHT} alt={alt} priority={priority} className={className} />
}

/**
 * The cap mark alone, for tight spaces (collapsed sidebars, chat avatars): a window
 * over the left of the full-height logo, so nothing is stretched or redrawn.
 * `size` is the mark's height in pixels; the cap is ~1.2× as wide as it is tall.
 */
export function LogoMark({ size = 32, className, priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("block shrink-0 overflow-hidden", className)} style={{ height: size, width: Math.ceil(size * 1.22) }}>
      <Image src={SRC} width={WIDTH} height={HEIGHT} alt="" priority={priority} className="h-full w-auto max-w-none" />
    </span>
  )
}
