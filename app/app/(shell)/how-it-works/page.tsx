import { HowItWorksSteps } from "@/components/shared/how-it-works-steps"
import { PageHeader } from "@/components/shared/page-header"

const PROMISES = [
  {
    title: "Verified sources first",
    body: "Answers come from the student handbook, guides reviewed by university staff, and the official office directory.",
  },
  {
    title: "Honest about gaps",
    body: "If no verified source covers your question, it says so and tells you which office to contact.",
  },
  {
    title: "Guidance, not transactions",
    body: "It explains how to file a request or where to go. It never submits requests or changes your records.",
  },
]

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="How It Works"
        description="Campus Agent helps you understand official university processes and find the right office."
      />

      <HowItWorksSteps className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8" />

      <h2 className="mt-16 text-lg font-semibold">What you can rely on</h2>
      <dl className="mt-4 divide-y border-y">
        {PROMISES.map((p) => (
          <div key={p.title} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="font-medium">{p.title}</dt>
            <dd className="text-muted-foreground">{p.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
