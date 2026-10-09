import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { describeStatus, getDocumentStats } from "@/app/admin/documents/document-stats"
import { AnalyzeSourceButton } from "@/components/admin/analyze-source-button"
import { SourceActions } from "@/components/admin/source-actions"
import { SourceSections } from "@/components/admin/source-sections"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { collectionHref } from "@/lib/knowledge/collections"
import { toSourceSections } from "@/lib/knowledge/sections"
import { formatFileSize, sourceFormat, sourceTypeLabel } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Analyze with AI runs as a server action from this page: extraction plus one Claude call.
export const maxDuration = 120

// Knowledge Library → source details (route kept as /admin/documents/[id]).
// The original file or text comes first (the source of truth); its knowledge sections follow below.
export default async function SourceDetailPage({ params }: PageProps<"/admin/documents/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const supabase = await createClient()
  const [{ data: doc, error }, { data: records, error: sectionError }, stats, { timezone }, { data: collections }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, document_type, file_path, file_name, mime_type, file_size, status, processing_error, visibility, created_at, summary, key_topics, analyzed_at, collection_id, description, reference_label, source_url, knowledge_collections(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("guidelines")
      .select("id, title, content, description, status, requirements, created_at, updated_at, source_reference, source_order, sort_order, guideline_steps(step_number, title, description)")
      .eq("source_document_id", id),
    getDocumentStats(id),
    getBranding(),
    supabase.from("knowledge_collections").select("id, name").order("name"),
  ])
  if (error) throw new Error("The source could not be loaded.")
  if (!doc) notFound()

  const format = sourceFormat(doc.mime_type)
  const isPdf = format === "pdf"
  const isText = format === "text"
  const analyzable = isPdf || isText
  const status = describeStatus(doc.status)
  // Private bucket: a short-lived signed link for admins to view the file; a text
  // source's text is read and shown in the page.
  let fileUrl: string | null = null
  let text: string | null = null
  if (isText) {
    const { data: file } = await supabase.storage.from("documents").download(doc.file_path)
    text = file ? await file.text() : null
  } else {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60 * 60)
    fileUrl = signed?.signedUrl ?? null
  }

  const sections = toSourceSections(records ?? [])
  const total = sections.filter((s) => s.status !== "archived").length
  const published = sections.filter((s) => s.status === "published").length
  const drafts = sections.filter((s) => s.status === "draft").length
  const health = sourceHealth({ status: doc.status, analyzable, verb: isPdf ? "Analyze" : "Organize", total, published, drafts })
  const date = (iso: string) => formatDate(iso, timezone, { month: "short", day: "numeric", year: "numeric" })
  // Compact source metadata under the description. Visibility and the uploader are kept in
  // the database but not shown here.
  const facts: [label: string, value: string][] = [
    ["Source type", `${isPdf ? "PDF" : isText ? "Text" : "Image"} · ${sourceTypeLabel(doc.document_type)}`],
    isText
      ? ["Length", `${(text?.length ?? 0).toLocaleString("en-US")} characters`]
      : ["File", `${doc.file_name} · ${formatFileSize(doc.file_size)}${stats.pages ? ` · ${stats.pages} pages` : ""}`],
    [isText ? "Created" : "Uploaded", date(doc.created_at)],
    ...(analyzable ? [["Last analyzed", doc.analyzed_at ? date(doc.analyzed_at) : "Not analyzed yet"] as [string, string]] : []),
    ...(doc.reference_label ? [["Reference", doc.reference_label] as [string, string]] : []),
  ]

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <li className="shrink-0"><Link href="/admin/knowledge" className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">Knowledge Library</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li className="min-w-0 max-w-64 truncate"><Link href={collectionHref(doc.collection_id)} className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">{doc.knowledge_collections?.name ?? "Uncategorized"}</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">{doc.title}</li>
        </ol>
      </nav>

      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--ink)]">{doc.title}</h1>
            <StatusBadge status={status.tone} label={status.label} />
          </div>
          {/* Admin metadata only; answers come from Published sections. */}
          {doc.description && <p className="mt-2 max-w-prose text-sm leading-relaxed break-words whitespace-pre-line text-foreground/80">{doc.description}</p>}
          <dl aria-label="Source details" className="mt-4 grid max-w-2xl grid-cols-1 gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground/90" title={value}>{value}</dd>
              </div>
            ))}
            {doc.source_url && (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Original</dt>
                <dd className="mt-0.5 truncate">
                  <a href={doc.source_url} target="_blank" rel="noopener noreferrer" className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" title={doc.source_url}>Open original source</a>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <SourceActions
          id={doc.id}
          title={doc.title}
          description={doc.description}
          status={doc.status}
          isPdf={isPdf}
          isText={isText}
          fileUrl={fileUrl}
          publishedCount={published}
          otherSectionCount={sections.length - published}
          collectionId={doc.collection_id}
          collections={collections ?? []}
        />
      </header>

      {doc.processing_error && (
        <p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {doc.processing_error}
        </p>
      )}

      <section aria-labelledby="status-heading" className="mt-8 border-t pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h2 id="status-heading" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Knowledge status</h2>
            <p className="mt-2 font-medium">{health.title}</p>
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{health.detail}</p>
            {analyzable && total > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {doc.analyzed_at ? `Last analyzed ${date(doc.analyzed_at)} · ` : ""}
                {total} {total === 1 ? "section" : "sections"} · {published} published · {drafts} {drafts === 1 ? "draft" : "drafts"}
              </p>
            )}
          </div>
          {analyzable && doc.status !== "archived" && (
            <AnalyzeSourceButton id={doc.id} format={isPdf ? "pdf" : "text"} analyzed={!!doc.analyzed_at || sections.length > 0} processing={doc.status === "processing"} />
          )}
        </div>
      </section>

      <section aria-labelledby="original-heading" className="mt-10">
        <h2 id="original-heading" className="text-lg font-semibold">{isPdf ? "Original PDF" : isText ? "Original text" : "Original image"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">The source of truth. Check each section against it before publishing.</p>
        {isText ? (
          text !== null ? (
            <div className="mt-4 max-h-[min(80vh,820px)] overflow-y-auto rounded-lg border bg-background px-5 py-4 text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</div>
          ) : (
            <p role="alert" className="mt-4 text-sm text-destructive">The text could not be loaded. Refresh the page to try again.</p>
          )
        ) : fileUrl ? (
          isPdf ? (
            <iframe src={`${fileUrl}#view=FitH`} title={`${doc.title} (PDF)`} className="mt-4 h-[min(80vh,820px)] w-full rounded-lg border bg-muted" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={fileUrl} alt={`${doc.title} (uploaded image)`} className="mt-4 max-h-[80vh] w-auto max-w-full rounded-lg border bg-background" />
          )
        ) : (
          <p role="alert" className="mt-4 text-sm text-destructive">The file could not be opened. Refresh the page to try again.</p>
        )}
      </section>

      {analyzable && (sectionError ? (
        <p role="alert" className="mt-10 text-sm text-destructive">The knowledge sections could not be loaded. Please refresh this page.</p>
      ) : (
        <SourceSections
          documentId={doc.id}
          sections={sections}
          overview={doc.summary ? { summary: doc.summary, topics: doc.key_topics } : null}
          format={isPdf ? "pdf" : "text"}
          canAdd={doc.status !== "archived"}
          emptyMessage={
            doc.status === "processing"
              ? "Analysis is in progress. Draft sections appear here when it finishes."
              : isPdf
                ? "No knowledge sections yet. Choose Analyze with AI to extract Draft sections from this PDF, or add a section yourself. Nothing is published automatically."
                : "No knowledge sections yet. Choose Organize with AI to split this text into Draft sections, or add a section yourself. Nothing is published automatically."
          }
        />
      ))}
    </div>
  )
}

/** One-line state of the source for admins, derived from data already on the page. */
function sourceHealth({ status, analyzable, verb, total, published, drafts }: {
  status: string
  analyzable: boolean
  verb: "Analyze" | "Organize"
  total: number
  published: number
  drafts: number
}): { title: string; detail: string } {
  if (status === "archived") return { title: "Archived", detail: "This source and its sections are not used by Campus Agent." }
  if (status === "processing") return { title: "Analysis in progress", detail: "Draft sections appear below when it finishes." }
  if (status === "failed") {
    return { title: "Analysis failed", detail: published ? "Published sections are still in use. Fix the issue above and re-analyze." : "Fix the issue above and analyze again." }
  }
  if (!analyzable) return { title: "Reference file", detail: "Stored for admins and the campus map. Images are not analyzed." }
  if (total === 0) return { title: verb === "Analyze" ? "Not analyzed yet" : "Not organized yet", detail: `${verb} this source with AI to create draft knowledge sections for review, or add sections yourself.` }
  if (drafts > 0) return { title: "Needs review", detail: `${drafts} draft ${drafts === 1 ? "section is" : "sections are"} waiting for review before publishing.` }
  if (published > 0) return { title: "Ready for Campus Agent answers", detail: `${published} published ${published === 1 ? "section is" : "sections are"} used by Campus Agent.` }
  return { title: "No published sections", detail: "Publish reviewed sections to make them available to Campus Agent." }
}
