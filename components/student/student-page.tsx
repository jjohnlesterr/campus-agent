import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"

// Placeholder for student sections whose content arrives in later phases.
export function StudentPlaceholderPage({
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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title={title} description={description} />
      <div className="mt-8">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    </div>
  )
}
