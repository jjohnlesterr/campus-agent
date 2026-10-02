import { LogoMark } from "@/components/shared/logo"

/** Quiet "Loading…" line with the cap mark, shown above page skeletons. */
export function LoadingMark() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <LogoMark size={18} className="motion-safe:animate-pulse" />
      Loading…
    </p>
  )
}
