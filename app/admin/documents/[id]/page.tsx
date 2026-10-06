import { ChevronRight, CircleAlert, CircleCheck, CircleDashed, Clock, FileText, Globe, ImageIcon, Lock, type LucideIcon, MapPin, Sparkles } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { describeStatus, getDocumentStats } from "@/app/admin/documents/document-stats"
import { type SectionRow, SectionList } from "@/components/admin/section-list"
import { SourceActions } from "@/components/admin/source-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { pageLabel, readGuideReference } from "@/lib/knowledge/topics"
import { formatFileSize, sourceTypeLabel } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Analyze with AI runs as a server action from this page: extraction plus one Claude call.
export const maxDuration = 120

// Knowledge Library → source details (route kept as /admin/documents/[id]).
export default async function SourceDetailPage({ params }: PageProps<"/admin/documents/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const supabase = await createClient()
  const [{ data: doc, error }, { data: sections, error: sectionError }, stats, { timezone }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, document_type, file_path, file_name, mime_type, file_size, status, processing_error, visibility, created_at, summary, key_topics, analyzed_at, profiles(full_name, email)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("guidelines")
      .select("id, title, status, updated_at, source_reference, guideline_categories(name)")
      .eq("source_document_id", id),
    getDocumentStats(id),
    getBranding(),
  ])
  if (error) throw new Error("The source could not be loaded.")
  if (!doc) notFound()

  const isPdf = doc.mime_type === "application/pdf"
  const status = describeStatus(doc.status)
  // Private bucket: a short-lived signed link for admins to view the file.
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60 * 60)
  const fileUrl = signed?.signedUrl ?? null

  const rows: SectionRow[] = (sections ?? []).map((s) => {
    const pages = readGuideReference(s.source_reference)?.pages ?? []
    return { id: s.id, title: s.title, status: s.status, category: s.guideline_categories?.name ?? null, pages, pageLabel: pages.length ? pageLabel(pages) : "—", updatedAt: s.updated_at }
  })
  const count = (value: SectionRow["status"]) => rows.filter((r) => r.status === value).length
  const date = (iso: string) => formatDate(iso, timezone, { month: "short", day: "numeric", year: "numeric" })
  const uploader = doc.profiles?.full_name || doc.profiles?.email || "—"

  const published = count("published")
  const drafts = count("draft")
  const health = sourceHealth({ status: doc.status, isPdf, total: rows.length, published, drafts })
  const HealthIcon = health.icon

  const sourceInfo: [string, string][] = [
    ["Type", `${isPdf ? "PDF" : "Image"} · ${sourceTypeLabel(doc.document_type)}`],
    ["File name", doc.file_name],
    ["Size", `${formatFileSize(doc.file_size)}${stats.pages ? ` · ${stats.pages} pages` : ""}`],
    ["Uploaded by", uploader],
    ["Uploaded", date(doc.created_at)],
    ...(isPdf ? ([["Last analyzed", doc.analyzed_at ? date(doc.analyzed_at) : "Not analyzed yet"]] as [string, string][]) : []),
  ]

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <li className="shrink-0"><Link href="/admin/knowledge" className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">Knowledge Library</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">{doc.title}</li>
        </ol>
      </nav>

      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg border bg-accent text-accent-foreground" aria-hidden="true">
            {isPdf ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--ink)]">{doc.title}</h1>
              <StatusBadge status={status.tone} label={status.label} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPdf ? "Original source and the knowledge sections extracted from it." : "Reference image. Images are not analyzed into knowledge sections."}
            </p>
          </div>
        </div>
        <SourceActions
          id={doc.id}
          title={doc.title}
          status={doc.status}
          isPdf={isPdf}
          fileUrl={fileUrl}
          analyzed={!!doc.analyzed_at || rows.length > 0}
          publishedCount={published}
          otherSectionCount={rows.length - published}
        />
      </header>

      {doc.processing_error && (
        <p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {doc.processing_error}
        </p>
      )}

      <section aria-label="Source overview" className="mt-5 grid overflow-hidden rounded-lg border bg-background lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 px-5 py-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Source info</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {sourceInfo.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium" title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0 border-t px-5 py-4 lg:border-t-0 lg:border-l">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Publishing</h2>
          <dl className="mt-3">
            <dt className="text-xs text-muted-foreground">Visible to</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
              {doc.visibility === "public"
                ? <Globe className="size-3.5 text-muted-foreground" aria-hidden="true" />
                : <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
              {doc.visibility === "public" ? "Everyone" : "Signed-in students"}
            </dd>
          </dl>
          {isPdf ? (
            <dl className="mt-4 grid grid-cols-3 gap-2">
              {([
                ["Total", rows.length, null],
                ["Published", published, "bg-[var(--success)]"],
                ["Draft", drafts, "bg-muted-foreground/60"],
              ] as const).map(([label, value, dot]) => (
                <div key={label} className="min-w-0 rounded-md bg-muted/60 px-3 py-2">
                  <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {dot && <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />}
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-lg leading-tight font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Reference file — not used to answer students.</p>
          )}
        </div>

        <div className="min-w-0 border-t px-5 py-4 lg:border-t-0 lg:border-l">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Status</h2>
          <div className="mt-3 flex items-start gap-3">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-md border ${HEALTH_TONES[health.tone]}`} aria-hidden="true">
              <HealthIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{health.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{health.detail}</p>
            </div>
          </div>
          {doc.document_type === "campus_map" && (
            // The map legend (location records used for "Where is…?" answers) is managed on its own page.
            <Link href="/admin/locations" className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              <MapPin className="size-3.5" aria-hidden="true" />
              Map locations and legend
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <div className={isPdf ? "mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "mt-6"}>
        <section aria-labelledby="preview-heading" className="min-w-0">
          <h2 id="preview-heading" className="font-semibold">Original source</h2>
          {fileUrl ? (
            isPdf ? (
              <iframe src={`${fileUrl}#view=FitH`} title={`${doc.title} (PDF)`} className="mt-3 h-[min(70vh,640px)] w-full rounded-lg border bg-muted" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img src={fileUrl} alt={`${doc.title} (uploaded image)`} className="mt-3 max-h-[70vh] w-auto max-w-full rounded-lg border bg-background" />
            )
          ) : (
            <p role="alert" className="mt-3 text-sm text-destructive">The file could not be opened. Refresh the page to try again.</p>
          )}
        </section>

        {isPdf && (
          <section aria-labelledby="overview-heading" className="min-w-0 rounded-lg border bg-background p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              <h2 id="overview-heading" className="font-semibold">Document overview</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">AI-generated for admin review only. It is not used to answer students.</p>
            {doc.summary ? (
              <>
                <p className="mt-4 text-sm leading-relaxed">{doc.summary}</p>
                {doc.key_topics.length > 0 && (
                  <>
                    <h3 className="mt-5 text-xs font-medium text-muted-foreground">Key topics detected</h3>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {doc.key_topics.map((topic) => (
                        <li key={topic} className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium">{topic}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {doc.status === "processing"
                  ? "Analysis is in progress."
                  : doc.analyzed_at
                    ? "No overview was generated in the last analysis. Re-analyze to try again; existing sections are kept."
                    : "Choose Analyze with AI to extract this document into reviewable knowledge sections and get a short overview."}
              </p>
            )}
          </section>
        )}
      </div>

      {isPdf && (
        <section aria-labelledby="sections-heading" className="mt-8">
          <h2 id="sections-heading" className="font-semibold">Extracted Knowledge Sections</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only Published sections are used by Campus Agent. Review each Draft against the original source before publishing.
          </p>
          {sectionError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">The sections could not be loaded. Please refresh this page.</p>
          ) : (
            <SectionList sections={rows} timezone={timezone} />
          )}
        </section>
      )}
    </div>
  )
}

type HealthTone = "success" | "attention" | "neutral" | "error"

const HEALTH_TONES: Record<HealthTone, string> = {
  success: "border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success)]",
  attention: "border-[var(--attention-border)] bg-[var(--attention-surface)] text-[var(--attention)]",
  neutral: "border-border bg-muted text-muted-foreground",
  error: "border-destructive/25 bg-destructive/8 text-destructive",
}

/** One-line state of the source for admins, derived from data already on the page. */
function sourceHealth({ status, isPdf, total, published, drafts }: {
  status: string
  isPdf: boolean
  total: number
  published: number
  drafts: number
}): { tone: HealthTone; icon: LucideIcon; title: string; detail: string } {
  if (status === "archived") return { tone: "neutral", icon: CircleDashed, title: "Archived", detail: "This source and its sections are not used by Campus Agent." }
  if (status === "processing") return { tone: "attention", icon: Clock, title: "Analysis in progress", detail: "Extracted sections appear below when it finishes." }
  if (status === "failed") {
    return { tone: "error", icon: CircleAlert, title: "Analysis failed", detail: published ? "Published sections are still in use. Fix the issue above and re-analyze." : "Fix the issue above and analyze again." }
  }
  if (!isPdf) return { tone: "neutral", icon: CircleCheck, title: "Reference file", detail: "Stored for admins and the campus map. Images are not analyzed." }
  if (total === 0) return { tone: "neutral", icon: Sparkles, title: "Not analyzed yet", detail: "Analyze with AI to extract sections for review." }
  if (drafts > 0) {
    return { tone: "attention", icon: CircleAlert, title: "Needs review before publishing", detail: `${drafts} draft ${drafts === 1 ? "section is" : "sections are"} waiting for review.` }
  }
  if (published > 0) {
    return { tone: "success", icon: CircleCheck, title: "Ready for student-facing answers", detail: `${published} published ${published === 1 ? "section is" : "sections are"} used by Campus Agent.` }
  }
  return { tone: "neutral", icon: CircleDashed, title: "No published sections", detail: "Publish reviewed sections to make them available to Campus Agent." }
}
