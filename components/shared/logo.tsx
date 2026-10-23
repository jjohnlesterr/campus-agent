import Image from "next/image"
import { cn } from "cn"

// public/assets/newlogo.png is a 2172×724 lockup: CECT seal with graduation cap + "CECT Agent".
const SRC = "/assets/newlogo.png"
const WIDTH = 2172
const HEIGHT = 724
// public/assets/newlogo-mark.png is the seal and cap alone, cut from the same artwork (256×256).
const MARK_SRC = "/assets/newlogo-mark.png"

/** Full logo. Size it by height (e.g. "h-10 w-auto"); object-contain keeps the aspect ratio. `sizes` is its rendered width. */
export function Logo({ className = "h-10 w-auto", priority = false, alt = "CECT Agent", sizes = "168px" }: { className?: string; priority?: boolean; alt?: string; sizes?: string }) {
  return <Image src={SRC} width={WIDTH} height={HEIGHT} alt={alt} priority={priority} sizes={sizes} className={cn("object-contain", className)} />
}

/** The seal and cap alone, for tight spaces (collapsed sidebars, chat avatars). `size` is its width and height in pixels. */
export function LogoMark({ size = 32, className, priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image src={MARK_SRC} width={size} height={size} alt="" aria-hidden="true" priority={priority} className={cn("block shrink-0 object-contain", className)} />
  )
}
