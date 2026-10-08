import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { MoveToCollectionButton } from "@/components/admin/collection-dialogs"
import { GuideEditor } from "@/components/admin/guide-editor"
import { SourcePagePreview } from "@/components/admin/source-page-preview"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { collectionHref } from "@/lib/knowledge/collections"
import { readGuideReference } from "@/lib/knowledge/topics"
import { createClient } from "@/lib/supabase/server"

// Knowledge Library → review / edit one knowledge section (AI-extracted or manual).
export default async function SectionReviewPage({ params, searchParams }: PageProps<"/admin/knowledge/[id]">) {
  await requireAdmin()
  const { id } = await params
  const { created } = await searchParams
  if (!z.uuid().safeParse(id).success) notFound()
  const db = await createClient()
  const [{ data: section, error }, { data: categories, error: categoryError }, { data: offices, error: officeError }, { timezone }, { data: collections }] = await Promise.all([
    db.from("guidelines").select("*, documents(id, title, file_name, file_path, mime_type, collection_id, knowledge_collections(id, name)), knowledge_collections(id, name), guideline_steps(step_number, title, description)").eq("id", id).maybeSingle(),
    db.from("guideline_categories").select("id, name").order("sort_order").order("name"),
    db.from("offices").select("id, name").order("name"),
    getBranding(),
    db.from("knowledge_collections").select("id, name").order("name"),
  ])
  if (error || categoryError || officeError) throw new Error("The section could not be loaded.")
  if (!section) notFound()

  const source = section.documents
  const fromSource = !!section.source_document_id
  const reference = readGuideReference(section.source_reference)
  const pages = reference?.pages ?? []
  const { data: signed } = source
    ? await db.storage.from("documents").createSignedUrl(source.file_path, 60 * 60)
    : { data: null }
  // A section's collection is its source's; a manual entry has its own.
  const collectionId = source ? source.collection_id : section.collection_id
  const collectionName = (source ? source.knowledge_collections?.name : section.knowledge_collections?.name) ?? "Uncategorized"
  const backHref = source ? `/admin/documents/${source.id}` : collectionHref(collectionId)

  const editor = (
    <GuideEditor
      key={section.updated_at}
      fromSource={fromSource}
      backHref={backHref}
      categories={categories ?? []}
      offices={offices ?? []}
      values={{
        id: section.id,
        updatedAt: section.updated_at,
        title: section.title,
        categoryId: section.category_id,
        description: section.description ?? "",
        content: section.content ?? "",
        requirements: section.requirements,
        steps: [...section.guideline_steps].sort((a, b) => a.step_number - b.step_number).map((s) => ({ title: s.title, description: s.description ?? "" })),
        pages,
        referenceNote: reference ? "" : section.source_reference ?? "",
        visibility: section.visibility,
        responsibleOfficeId: section.responsible_office_id,
        status: section.status,
      }}
    />
  )

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
          <li><Link href="/admin/knowledge" className="hover:text-foreground hover:underline">Knowledge Library</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li className="max-w-64 truncate"><Link href={collectionHref(collectionId)} className="hover:text-foreground hover:underline">{collectionName}</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          {source && (
            <>
              <li className="max-w-64 truncate"><Link href={`/admin/documents/${source.id}`} className="hover:text-foreground hover:underline">{source.title}</Link></li>
              <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
            </>
          )}
          <li aria-current="page" className="max-w-64 truncate font-medium text-foreground">{section.title}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{fromSource ? "Review knowledge section" : "Manual entry"}</h1>
          <StatusBadge status={section.status} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Last updated <time dateTime={section.updated_at}>{formatDate(section.updated_at, timezone, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time>
          </p>
          {!fromSource && (
            <MoveToCollectionButton kind="manual" id={section.id} title={section.title} currentCollectionId={section.collection_id} collections={collections ?? []} />
          )}
        </div>
      </div>
      {created === "1" && <p role="status" className="mt-4 text-sm text-muted-foreground">Entry created.</p>}

      {fromSource ? (
        <div className="mt-5 grid items-start gap-6 xl:grid-cols-2">
          <section aria-label="Original source" className="min-w-0 xl:sticky xl:top-4">
            {source && signed?.signedUrl && source.mime_type === "application/pdf" ? (
              <SourcePagePreview url={signed.signedUrl} title={source.title} fileName={source.file_name} pages={pages} />
            ) : (
              <p role="alert" className="rounded-lg border bg-background px-4 py-3 text-sm text-destructive">
                The original file could not be opened. {source ? <Link href={`/admin/documents/${source.id}`} className="font-medium underline">Open the source</Link> : "Its source was removed."}
              </p>
            )}
          </section>
          <section aria-label="Extracted knowledge" className="min-w-0 rounded-lg border bg-background p-5 sm:p-6">
            {editor}
          </section>
        </div>
      ) : (
        <section aria-label="Entry" className="mt-5 max-w-3xl rounded-lg border bg-background p-5 sm:p-6">
          {editor}
        </section>
      )}
    </div>
  )
}
