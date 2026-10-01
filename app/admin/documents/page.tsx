import { FileText } from "lucide-react"
import Link from "next/link"

import { describeStatus, getDocumentStats } from "@/app/admin/documents/document-stats"
import { HandbookUploader } from "@/components/admin/handbook-uploader"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

export default async function DocumentsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ timezone }, { data: documents }] = await Promise.all([
    getBranding(),
    supabase
      .from("documents")
      .select("id, title, file_name, status, processing_error, visibility, created_at")
      .order("created_at", { ascending: false }),
  ])
  const rows = await Promise.all(
    (documents ?? []).map(async (d) => ({ ...d, stats: await getDocumentStats(d.id) }))
  )

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload the student handbook. Its text is extracted page by page so answers can cite the exact page."
      />

      <section aria-labelledby="upload-heading" className="mt-6 rounded-lg border bg-background p-6">
        <h2 id="upload-heading" className="mb-5 font-semibold">
          Upload handbook
        </h2>
        <HandbookUploader />
      </section>

      <section aria-labelledby="documents-heading" className="mt-6 overflow-hidden rounded-lg border bg-background">
        <h2 id="documents-heading" className="border-b px-5 py-4 font-semibold">
          Uploaded documents
        </h2>
        {rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Document</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Uploaded</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Pages</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Sections</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((d) => {
                const status = describeStatus(d.status)
                return (
                  <tr key={d.id} className="align-top hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <span className="font-medium">{d.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.file_name} · {d.visibility === "public" ? "Public" : "Students only"}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                      {formatDate(d.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{d.stats.pages ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums">{d.stats.chunks || "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={status.tone} label={status.label} />
                      {d.processing_error && (
                        <span className="mt-1 block max-w-xs text-xs text-destructive">{d.processing_error}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/documents/${d.id}`} className="font-medium text-primary hover:underline">
                        View<span className="sr-only"> {d.title}</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-2">
            <EmptyState
              icon={FileText}
              title="No documents uploaded yet."
              description="Upload the student handbook PDF to make it available to Campus Agent."
            />
          </div>
        )}
      </section>
    </>
  )
}
