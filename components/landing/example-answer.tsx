import { FileText, MapPin } from "lucide-react"

// Example of Campus Agent's structured answer format, for the public page.
// Content comes from the university's verified sources: enrollment rules from
// the handbook (Information WUP, page 1) and the Registrar's location from the
// official campus map legend.
const steps = [
  "Register during the official registration period set in the academic calendar.",
  "Submit your valid credentials.",
  "Pay the required fees.",
  "You are officially enrolled once your credentials are submitted and your fees are paid.",
]

export function ExampleAnswer() {
  return (
    <figure
      aria-label="Example of a Campus Agent answer"
      className="overflow-hidden rounded-xl border bg-card text-sm shadow-[0_1px_2px_oklch(0.22_0.025_262/0.05),0_12px_32px_-12px_oklch(0.22_0.025_262/0.18)]"
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-5 py-3">
        <p className="font-medium">How do I enroll?</p>
        <span className="shrink-0 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          Example
        </span>
      </div>

      <div className="px-5 pt-4 pb-5">
        <h3 className="answer-step text-base font-semibold" style={{ "--step": 0 } as React.CSSProperties}>
          Enrolling at the university
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

        <div
          className="answer-step mt-5 flex items-start gap-2 border-t pt-4"
          style={{ "--step": steps.length + 1 } as React.CSSProperties}
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <span className="font-medium">Registrar</span>
            <span className="block text-muted-foreground">L1, Gloria D. Lacson Building (Building 1)</span>
          </p>
        </div>

        <div
          className="answer-step mt-4 flex items-start gap-2 rounded-md bg-muted/70 px-3 py-2.5"
          style={{ "--step": steps.length + 2 } as React.CSSProperties}
        >
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Sources:</span> Information WUP — Page 1; Official campus map —
            Building 1
          </p>
        </div>
      </div>

      <figcaption className="border-t px-5 py-2.5 text-xs text-muted-foreground">
        Example of the answer format. Real answers cite the university&apos;s verified sources.
      </figcaption>
    </figure>
  )
}
