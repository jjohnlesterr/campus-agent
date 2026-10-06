import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { ManualEntryForm } from "@/components/admin/manual-entry-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function NewManualEntryPage() {
  await requireAdmin()
  const db = await createClient()
  const [{ data: categories, error }, { data: offices, error: officeError }] = await Promise.all([
    db.from("guideline_categories").select("id, name, slug").order("sort_order").order("name"),
    db.from("offices").select("id, name").order("name"),
  ])
  if (error || officeError) throw new Error("The form could not be loaded.")

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex items-center gap-1.5 text-muted-foreground">
          <li><Link href="/admin/knowledge" className="hover:text-foreground hover:underline">Knowledge Library</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="font-medium text-foreground">Create manually</li>
        </ol>
      </nav>
      <PageHeader title="Create knowledge entry" description="Add verified information that isn’t in an uploaded file. No source file is needed." />
      <div className="mt-6 max-w-3xl rounded-lg border bg-background p-5 sm:p-6">
        <ManualEntryForm
          categories={categories ?? []}
          offices={offices ?? []}
          defaultCategoryId={categories?.find((c) => c.slug === "general-information")?.id}
        />
      </div>
    </>
  )
}
