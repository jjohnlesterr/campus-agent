import { ChevronLeft, ChevronRight, ExternalLink, FileText, Map as MapIcon } from "lucide-react"
import Link from "next/link"

import { RowsPerPage } from "@/components/admin/rows-per-page"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { getActiveCampusMap } from "@/lib/campus/locations"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZES = [10, 20, 50]

export default async function AdminLocationsPage({ searchParams }: PageProps<"/admin/locations">) {
  await requireAdmin()
  const supabase = await createClient()
  const params = await searchParams
  const per = PAGE_SIZES.includes(Number(params.per)) ? Number(params.per) : PAGE_SIZES[0]
  const requestedPage = Math.max(1, Math.floor(Number(params.page)) || 1)

  const [{ timezone }, { map: activeMap, count: mapCount }, { count: total }] = await Promise.all([
    getBranding(),
    getActiveCampusMap(supabase),
    supabase.from("campus_locations").select("id", { count: "exact", head: true }),
  ])
  // Clamp to the last page, so pagination stays valid after records are added or removed.
  const totalRows = total ?? 0
  const pageCount = Math.max(1, Math.ceil(totalRows / per))
  const page = Math.min(requestedPage, pageCount)
  const from = (page - 1) * per

  // Only this page's rows. Official legend entries first, by building number; older
  // unnumbered records last; id keeps the order stable across pages.
  const { data: locations } = await supabase
    .from("campus_locations")
    .select("id, name, building_name, building_number, floor, offices(name)")
    .order("building_number", { nullsFirst: false })
    .order("floor", { nullsFirst: true })
    .order("name")
    .order("id")
    .range(from, from + per - 1)
  const pageHref = (n: number) => `/admin/locations?per=${per}&page=${n}`
  // Private bucket: a short-lived signed link for admins.
  const { data: signed } = activeMap
    ? await supabase.storage.from("documents").createSignedUrl(activeMap.file_path, 60 * 60)
    : { data: null }
  const isImage = activeMap?.mime_type.startsWith("image/") ?? false

  return (
    <>
      <PageHeader
        title="Campus Map"
        description="The official campus map students see when they ask where an office or building is."
      >
        <Link href="/admin/documents" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Manage in Sources
        </Link>
      </PageHeader>

      {activeMap && signed?.signedUrl ? (
        <section aria-labelledby="map-heading" className="mt-6 overflow-hidden rounded-lg border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <div className="min-w-0">
              <h2 id="map-heading" className="truncate font-semibold">
                {activeMap.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                Active map · uploaded{" "}
                {formatDate(activeMap.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                {mapCount > 1 && ` · newest of ${mapCount} Campus Map sources`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/documents/${activeMap.id}`} className={buttonVariants({ variant: "ghost" })}>
                Source details
              </Link>
              <a href={signed.signedUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink aria-hidden="true" />
                Open full size
              </a>
            </div>
          </div>
          {isImage ? (
            <div className="bg-muted/30 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
              <img
                src={signed.signedUrl}
                alt={`${activeMap.title} — official campus map with numbered buildings`}
                className="mx-auto max-h-[75vh] w-auto rounded-md border bg-background"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted-foreground">
              <FileText className="size-5 shrink-0" aria-hidden="true" />
              This map is a PDF. Open it full size to view it, or upload a PNG/JPG version to display it here.
            </div>
          )}
        </section>
      ) : (
        <div className="mt-6 rounded-lg border bg-background p-2">
          <EmptyState
            icon={MapIcon}
            title="No campus map yet."
            description="Upload a Campus Map source to display it here."
          >
            <Link href="/admin/documents" className={buttonVariants({ size: "lg" })}>
              Go to Sources
            </Link>
          </EmptyState>
        </div>
      )}

      <section aria-labelledby="map-info-heading" className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h2 id="map-info-heading" className="font-semibold">
            Map information
          </h2>
          <div className="mt-2 flex max-w-prose flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Numbered buildings on the map correspond to the official map legend, which is stored as the location
              records here. When a student asks where an office is, Campus Agent answers from these records — for
              example, “Registrar is located on L1 of the Gloria D. Lacson Building (Building 1)” — and offers this map.
              Records without a building number are not used for answers.
            </p>
            <p>To replace the map, upload a new Campus Map source. The newest Ready one is shown here.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-background">
          <h3 className="border-b px-4 py-2.5 text-sm font-medium">Location records</h3>
          {locations && locations.length > 0 ? (
            <div role="region" aria-label="Campus locations table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">#</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Location</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Building</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Offices</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {locations.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.building_number ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{l.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[l.building_name, l.floor].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {l.offices.map((o) => o.name).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {locations && locations.length > 0 ? (
            <nav aria-label="Location records pages" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {from + 1}–{from + locations.length} of {totalRows}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <RowsPerPage id="locations-per-page" value={per} options={PAGE_SIZES} />
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <ChevronLeft aria-hidden="true" />
                      Previous
                    </Link>
                  ) : (
                    <button type="button" disabled className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <ChevronLeft aria-hidden="true" />
                      Previous
                    </button>
                  )}
                  <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums" aria-current="page">
                    Page {page} of {pageCount}
                  </span>
                  {page < pageCount ? (
                    <Link href={pageHref(page + 1)} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Next
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  ) : (
                    <button type="button" disabled className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Next
                      <ChevronRight aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </nav>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No location records yet. They are created when an office location is set.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
