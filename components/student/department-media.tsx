import type { DepartmentCard } from "@/lib/campus/departments"

/**
 * A department card's cover (fixed 16:9, object-cover at the admin's crop position) with its
 * logo overlapping the bottom-left corner — the same visual result as the admin gallery.
 */
export function DepartmentMedia({ department }: { department: DepartmentCard }) {
  return (
    <div className="relative aspect-video shrink-0 border-b bg-muted">
      {department.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- public storage URL
        <img src={department.coverUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" style={{ objectPosition: department.coverPosition }} />
      )}
      <span className="absolute -bottom-6 left-4 flex size-12 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-sm">
        {department.logoUrl
          // eslint-disable-next-line @next/next/no-img-element -- public storage URL
          ? <img src={department.logoUrl} alt="" loading="lazy" decoding="async" className="size-full object-contain p-1" />
          : <span className="text-xs font-semibold text-muted-foreground" aria-hidden="true">{department.shortName.slice(0, 4)}</span>}
      </span>
    </div>
  )
}
