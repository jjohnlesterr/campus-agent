import { cn } from "cn"

const STYLES: Record<string, string> = {
  published: "border-primary/25 bg-accent text-accent-foreground",
  draft: "border-border bg-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/8 text-destructive",
  archived: "border-border bg-muted text-muted-foreground",
}

/** `status` picks the colour; `label` overrides the text (defaults to the status). */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-px text-xs font-medium",
        !label && "capitalize",
        STYLES[status] ?? STYLES.draft
      )}
    >
      {label ?? status}
    </span>
  )
}
