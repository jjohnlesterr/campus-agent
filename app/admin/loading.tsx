// Shown in the admin content area while a page renders; the sidebar stays in place.
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-b pb-5">
        <div className="h-7 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-muted motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg border bg-background motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-lg border bg-background motion-safe:animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
