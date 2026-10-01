import { cn } from "cn"
import Link from "next/link"
import { z } from "zod"
import { PageHeader } from "@/components/shared/page-header"
import { GuideLibrary } from "@/components/admin/guide-library"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { libraryOptions } from "@/lib/knowledge/topics"
import { createClient } from "@/lib/supabase/server"

export default async function KnowledgeBasePage({ searchParams }: PageProps<"/admin/knowledge">) {
  await requireAdmin()
  const params = await searchParams
  const { status, sort } = libraryOptions(params.status, params.sort)
  const source = typeof params.source === "string" && z.uuid().safeParse(params.source).success ? params.source : undefined
  const db = await createClient()
  let query = db.from("guidelines").select("id, title, description, status, updated_at, source_reference, documents(title), guideline_steps(count)")
  if (status !== "all") query = query.eq("status", status)
  if (source) query = query.eq("source_document_id", source)
  query = sort === "az" ? query.order("title").order("id") : query.order("updated_at", { ascending: sort === "oldest" }).order("id")
  const [{ data: guides, error }, { timezone }] = await Promise.all([query, getBranding()])
  return (
    <>
      <PageHeader title="Knowledge Base" description="Review source-backed guides before publishing them for students.">
        <Link href="/admin/documents" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Open Sources</Link>
      </PageHeader>
      <GuideLibrary guides={guides ?? []} timezone={timezone} status={status} sort={sort} source={source} loadError={!!error} />
    </>
  )
}
