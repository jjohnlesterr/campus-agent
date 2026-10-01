import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div data-slot="empty-state" className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-6 py-10 sm:items-center sm:text-center">
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}
