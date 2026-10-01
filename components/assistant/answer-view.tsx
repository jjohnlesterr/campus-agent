import { CircleAlert, FileText, Info } from "lucide-react"

import { SimpleMarkdown } from "@/components/assistant/simple-markdown"
import type { StructuredAnswer } from "@/lib/ai/answer-types"

// Renders a Campus Agent answer: summary, steps, requirements, details,
// what the handbook doesn't cover, and the source line.
export function AnswerView({ answer }: { answer: StructuredAnswer }) {
  if (answer.status === "error") {
    return (
      <p className="flex items-start gap-2 text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {answer.summary}
      </p>
    )
  }
  if (answer.status === "not_found") {
    return (
      <p className="flex items-start gap-2">
        <Info className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {answer.summary}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p>{answer.summary}</p>

      {answer.steps.length > 0 && (
        <section aria-label="Steps">
          <ol className="flex flex-col gap-2.5">
            {answer.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">
                  <span className="sr-only">Step {i + 1}: </span>
                  <SimpleMarkdown text={step} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {answer.requirements.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Requirements</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
            {answer.requirements.map((r, i) => (
              <li key={i}>
                <SimpleMarkdown text={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.details &&
        (answer.steps.length > 0 || answer.requirements.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold">Good to know</h3>
            <div className="mt-2">
              <SimpleMarkdown text={answer.details} />
            </div>
          </section>
        ) : (
          <SimpleMarkdown text={answer.details} />
        ))}

      {answer.gaps && (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/60 px-3.5 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>
            <span className="font-medium">Not covered by the handbook: </span>
            {answer.gaps}
          </p>
        </div>
      )}

      {answer.sources.length > 0 && (
        <p className="flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Source:</span>{" "}
            {answer.sources.map((s) => s.label).join("; ")}
          </span>
        </p>
      )}
    </div>
  )
}
