import { cn } from "cn"

// Mark: an open book page with a bookmark — "the official source, marked".
export function Wordmark({
  name,
  className,
  tone = "default",
}: {
  name: string
  className?: string
  tone?: "default" | "inverse"
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn("size-6 shrink-0", tone === "inverse" ? "text-ink-foreground" : "text-primary")}
      >
        <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
        <path
          d="M8 7.5h8M8 11h8M8 14.5h4.5"
          stroke={tone === "inverse" ? "var(--ink)" : "white"}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M15.5 13.5v5l1.5-1.1 1.5 1.1v-5z" fill={tone === "inverse" ? "var(--ink)" : "white"} />
      </svg>
      <span>{name}</span>
    </span>
  )
}
