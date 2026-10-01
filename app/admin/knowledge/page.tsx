import { Library } from "lucide-react"

import { AdminPlaceholderPage } from "@/components/admin/admin-placeholder-page"
import { requireAdmin } from "@/lib/auth"

export default async function KnowledgeBasePage() {
  await requireAdmin()
  return (
    <AdminPlaceholderPage
      title="Knowledge Base"
      description="Verified school procedures students can browse and the assistant can cite. Drafts stay hidden until published."
      emptyIcon={Library}
      emptyTitle="No guides yet."
      emptyDescription="Creating, reviewing and publishing guides will be available here in the Knowledge Base phase."
    />
  )
}
