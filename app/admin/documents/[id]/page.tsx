import { RefreshCw } from "lucide-react"
import { notFound } from "next/navigation"

import { deleteDocument, reprocessDocument } from "@/app/admin/documents/actions"
import { describeStatus, getDocumentStats } from "@/app/admin/documents/document-stats"
import { DeleteButton } from "@/components/admin/delete-button"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { formatSourceLabel } from "@/lib/rag/sources"
import { createClient } from "@/lib/supabase/server"

const PREVIEW_LIMIT = 50

export default async function DocumentDetailPage({ params }: PageProps<"/admin/documents/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const [{ data: doc }, { data: chunks }, stats] = await Promise.all([
    supabase.from("documents").select("id, title, file_name, status, processing_error").eq("id", id).maybeSingle(),
    supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, section_title, content")
      .eq("document_id", id)
      .order("chunk_index")
      .limit(PREVIEW_LIMIT),
    getDocumentStats(id),
  ])
  if (!doc) notFound()
  const status = describeStatus(doc.status)

  return (
    <>
      <PageHeader title={doc.title} description={doc.file_name}>
        <div className="flex gap-2">
          <form action={reprocessDocument.bind(null, doc.id)}>
            <Button type="submit" variant="outline" size="lg">
              <RefreshCw aria-hidden="true" />
              Reprocess
            </Button>
          </form>
          <DeleteButton action={deleteDocument.bind(null, doc.id)} label={doc.title} />
        </div>
      </PageHeader>

      <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
        {[
          ["Status", <StatusBadge key="s" status={status.tone} label={status.label} />],
          ["Pages", stats.pages ?? "—"],
          ["Sections", stats.chunks],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {doc.processing_error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {doc.processing_error}
        </p>
      )}

      <section aria-labelledby="chunks-heading" className="mt-8">
        <h2 id="chunks-heading" className="font-semibold">
          Extracted sections
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.chunks > PREVIEW_LIMIT ? `First ${PREVIEW_LIMIT} of ${stats.chunks}. ` : ""}Each section keeps its page
          number for citations.
        </p>
        <ol className="mt-4 divide-y rounded-lg border bg-background">
          {(chunks ?? []).map((c) => (
            <li key={c.id} className="px-5 py-4">
              <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatSourceLabel({ documentTitle: doc.title, pageNumber: c.page_number })}
                </span>
                {c.section_title && <span>{c.section_title}</span>}
                <span className="tabular-nums">~{Math.ceil(c.content.length / 4)} tokens</span>
              </p>
              <p className="mt-2 line-clamp-4 max-w-prose text-sm leading-relaxed whitespace-pre-line">{c.content}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
