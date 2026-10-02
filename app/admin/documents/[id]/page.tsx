import { ExternalLink, RefreshCw } from "lucide-react"
import { notFound } from "next/navigation"

import { deleteDocument, reprocessDocument } from "@/app/admin/documents/actions"
import { describeStatus, getDocumentStats } from "@/app/admin/documents/document-stats"
import { DeleteButton } from "@/components/admin/delete-button"
import { CreateSourceGuides } from "@/components/admin/create-source-guides"
import { PageHeader } from "@/components/shared/page-header"
import { PendingSubmitButton } from "@/components/shared/pending-submit-button"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { formatSourceLabel } from "@/lib/rag/sources"
import { formatFileSize, isReferenceOnly, sourceTypeLabel } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

const PREVIEW_LIMIT = 50

export default async function SourceDetailPage({ params }: PageProps<"/admin/documents/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const [{ data: doc }, { data: chunks }, stats, { timezone }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, document_type, file_path, file_name, mime_type, file_size, status, processing_error, visibility, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, section_title, content")
      .eq("document_id", id)
      .order("chunk_index")
      .limit(PREVIEW_LIMIT),
    getDocumentStats(id),
    getBranding(),
  ])
  if (!doc) notFound()

  const referenceOnly = isReferenceOnly(doc.document_type, doc.mime_type)
  const isImage = doc.mime_type.startsWith("image/")
  const canReprocess = !referenceOnly && doc.mime_type === "application/pdf"
  const status = describeStatus(doc.status)
  // Private bucket: a short-lived signed link for admins to open the file.
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60 * 60)

  const facts: [string, React.ReactNode][] = [
    ["Type", sourceTypeLabel(doc.document_type)],
    ["Status", <StatusBadge key="status" status={status.tone} label={status.label} />],
    ["Uploaded", formatDate(doc.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })],
    ["File", `${doc.file_name} · ${formatFileSize(doc.file_size)}`],
    ["Visible to", doc.visibility === "public" ? "Everyone" : "Signed-in students"],
    referenceOnly
      ? ["Used by the assistant", "No — reference file"]
      : ["Text sections", `${stats.chunks}${stats.pages ? ` from ${stats.pages} pages` : ""}`],
  ]

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <PageHeader title={doc.title} description="Source details">
        <div className="flex flex-wrap gap-2">
          {signed?.signedUrl && (
            <a
              href={signed.signedUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <ExternalLink aria-hidden="true" />
              Open file
            </a>
          )}
          {canReprocess && (
            <form action={reprocessDocument.bind(null, doc.id)}>
              <PendingSubmitButton variant="outline" size="lg" pendingLabel="Reprocessing…">
                <RefreshCw aria-hidden="true" />
                Reprocess
              </PendingSubmitButton>
            </form>
          )}
          <DeleteButton action={deleteDocument.bind(null, doc.id)} label={doc.title} />
        </div>
      </PageHeader>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {doc.processing_error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {doc.processing_error}
        </p>
      )}

      {doc.status === "ready" && doc.mime_type === "application/pdf" && stats.chunks > 0 && (
        <CreateSourceGuides documentId={doc.id} />
      )}

      {isImage && signed?.signedUrl && (
        <section aria-labelledby="preview-heading" className="mt-8">
          <h2 id="preview-heading" className="font-semibold">
            Preview
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
          <img
            src={signed.signedUrl}
            alt={`${doc.title} (uploaded image)`}
            className="mt-4 max-h-[70vh] w-auto rounded-lg border bg-background"
          />
        </section>
      )}

      {!referenceOnly && (
        <section aria-labelledby="chunks-heading" className="mt-8">
          <h2 id="chunks-heading" className="font-semibold">
            Extracted sections
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.chunks > PREVIEW_LIMIT ? `First ${PREVIEW_LIMIT} of ${stats.chunks}. ` : ""}Each section keeps its page
            number for citations.
          </p>
          {chunks && chunks.length > 0 ? (
            <ol className="mt-4 divide-y rounded-lg border bg-background">
              {chunks.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatSourceLabel({ documentTitle: doc.title, pageNumber: c.page_number })}
                    </span>
                    {c.section_title && <span>{c.section_title}</span>}
                    <span className="tabular-nums">~{Math.ceil(c.content.length / 4)} tokens</span>
                  </p>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-line">
                    {c.content}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No text sections yet.</p>
          )}
        </section>
      )}
    </div>
  )
}
