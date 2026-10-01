const STEPS = [
  {
    title: "Ask in your own words",
    body: "Type a question the way you would ask a friend — “How do I fix my INC?” or “Where do I get my TOR?”",
  },
  {
    title: "Campus Agent checks verified sources",
    body: "It searches the handbook, published guides and the official office directory — not the open internet.",
  },
  {
    title: "Get steps you can follow",
    body: "Answers come as steps and requirements, with the responsible office, its hours and location, and the source.",
  },
]

export function HowItWorksSteps({ className }: { className?: string }) {
  return (
    <ol className={className ?? "grid gap-10 md:grid-cols-3 md:gap-8"}>
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex flex-col gap-3 md:pr-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-sm font-semibold text-primary tabular-nums"
            >
              {i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="hidden h-px flex-1 bg-border md:block" />
            )}
          </div>
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  )
}
