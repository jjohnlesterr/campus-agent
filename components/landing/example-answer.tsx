import { Clock, FileText, MapPin } from "lucide-react"

// Illustrative example of Campus Agent's structured answer format.
// Labelled on screen as an example: real answers come from the university's
// verified sources, which are not loaded yet.
const steps = [
  "Contact your instructor about the incomplete requirement.",
  "Complete the missing requirement within the allowed period.",
  "Submit the completion form with your instructor's signature.",
  "Wait for the Registrar to process the updated grade.",
  "Check your updated grade in your student records.",
]

export function ExampleAnswer() {
  return (
    <figure
      aria-label="Example of a Campus Agent answer"
      className="overflow-hidden rounded-xl border bg-card text-sm shadow-[0_1px_2px_oklch(0.22_0.025_262/0.05),0_12px_32px_-12px_oklch(0.22_0.025_262/0.18)]"
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-5 py-3">
        <p className="font-medium">How do I fix an INC grade?</p>
        <span className="shrink-0 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          Example
        </span>
      </div>

      <div className="px-5 pt-4 pb-5">
        <h3 className="answer-step text-base font-semibold" style={{ "--step": 0 } as React.CSSProperties}>
          Completing an Incomplete (INC) grade
        </h3>
        <ol className="mt-3 flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li
              key={step}
              className="answer-step flex gap-3"
              style={{ "--step": i + 1 } as React.CSSProperties}
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[0.7rem] font-semibold text-accent-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <span className="leading-5">{step}</span>
            </li>
          ))}
        </ol>

        <dl
          className="answer-step mt-5 grid gap-x-6 gap-y-2 border-t pt-4 sm:grid-cols-2"
          style={{ "--step": steps.length + 1 } as React.CSSProperties}
        >
          <div className="flex items-start gap-2">
            <dt className="sr-only">Office</dt>
            <MapPin className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <dd>
              <span className="font-medium">Office of the Registrar</span>
              <span className="block text-muted-foreground">Administration Building</span>
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Office hours</dt>
            <Clock className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <dd className="text-muted-foreground">Mon–Fri, 8:00 AM – 5:00 PM</dd>
          </div>
        </dl>

        <div
          className="answer-step mt-4 flex items-start gap-2 rounded-md bg-muted/70 px-3 py-2.5"
          style={{ "--step": steps.length + 2 } as React.CSSProperties}
        >
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Source:</span> Student Handbook — Incomplete
            Grades section
          </p>
        </div>
      </div>

      <figcaption className="border-t px-5 py-2.5 text-xs text-muted-foreground">
        Illustrative format. Real answers cite your university&apos;s verified documents.
      </figcaption>
    </figure>
  )
}
