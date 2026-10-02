// Shown in the student content area while a page renders; the sidebar stays in place.
export default function StudentLoading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-2 border-b pb-5">
        <div className="h-7 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded bg-muted motion-safe:animate-pulse" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 rounded-lg border bg-background motion-safe:animate-pulse" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
