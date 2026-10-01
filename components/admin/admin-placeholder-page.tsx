import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"

// Placeholder for admin modules whose management tools arrive in later phases.
export function AdminPlaceholderPage({
  title,
  description,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  title: string
  description: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mt-6 rounded-lg border bg-background p-2">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    </>
  )
}
