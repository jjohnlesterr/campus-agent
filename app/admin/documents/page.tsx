import { FileText } from "lucide-react"
import Link from "next/link"

import { describeStatus } from "@/app/admin/documents/document-stats"
import { SourceUploader } from "@/components/admin/source-uploader"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { isReferenceOnly, sourceTypeLabel } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Admin → Sources (route kept as /admin/documents; backed by the documents table).
export default async function SourcesPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ timezone }, { data: sources }] = await Promise.all([
    getBranding(),
    supabase
      .from("documents")
      .select("id, title, document_type, file_name, status, processing_error, created_at, document_chunks(count)")
      .order("created_at", { ascending: false }),
  ])
  const rows = sources ?? []

  return (
    <>
      <PageHeader
        title="Sources"
        description="Official files Campus Agent can rely on. Text from PDFs is extracted page by page so answers can cite the exact page."
      />

      <SourceUploader defaultOpen={rows.length === 0} />

      <section aria-labelledby="sources-heading" className="mt-6 overflow-hidden rounded-lg border bg-background">
        <h2 id="sources-heading" className="border-b px-5 py-4 font-semibold">
          All sources
        </h2>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Title</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">File name</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Uploaded</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((s) => {
                  const status = describeStatus(s.status)
                  const chunks = s.document_chunks[0]?.count ?? 0
                  return (
                    <tr key={s.id} className="align-top hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <span className="font-medium">{s.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {isReferenceOnly(s.document_type)
                            ? "Reference file"
                            : chunks > 0
                              ? `${chunks} sections for the assistant`
                              : "No text sections yet"}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">{sourceTypeLabel(s.document_type)}</td>
                      <td className="max-w-56 truncate px-5 py-3 text-muted-foreground" title={s.file_name}>
                        {s.file_name}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={status.tone} label={status.label} />
                        {s.processing_error && (
                          <span className="mt-1 block max-w-xs text-xs text-destructive">{s.processing_error}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                        {formatDate(s.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/admin/documents/${s.id}`} className="font-medium text-primary hover:underline">
                          View<span className="sr-only"> {s.title}</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-2">
            <EmptyState
              icon={FileText}
              title="No sources uploaded yet."
              description="Upload the student handbook and other official files to make them available to Campus Agent."
            />
          </div>
        )}
      </section>
    </>
  )
}
