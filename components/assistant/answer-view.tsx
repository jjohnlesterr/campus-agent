import { ArrowRight, CircleAlert, ExternalLink, FileText, Info, Map as MapIcon } from "lucide-react"
import Link from "next/link"

import { SimpleMarkdown } from "@/components/assistant/simple-markdown"
import { buttonVariants } from "@/components/ui/button"
import type { AnswerSource, LocationInfo, StructuredAnswer } from "@/lib/ai/answer-types"
import { safeSourceUrl } from "@/lib/announcements"

/** Opens the student Campus Map, scrolled to the building when there is just one. */
function CampusMapLink({ location }: { location?: LocationInfo }) {
  if (!location?.mapAvailable) return null
  const [only] = location.buildingNumbers
  const href = location.buildingNumbers.length === 1 ? `/app/map#building-${only}` : "/app/map"
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", className: "self-start" })}>
      <MapIcon aria-hidden="true" />
      View Campus Map
    </Link>
  )
}

/** In-app follow-up page for structured answers ("View all announcements"). */
function AnswerLink({ link }: { link?: StructuredAnswer["link"] }) {
  if (!link || !link.href.startsWith("/app/")) return null
  return (
    <Link href={link.href} className={buttonVariants({ variant: "outline", className: "self-start" })}>
      {link.label}
      <ArrowRight aria-hidden="true" />
    </Link>
  )
}

/** The source line. Announcements with a source URL link to the original post. */
function SourceLine({ sources }: { sources: AnswerSource[] }) {
  if (!sources.length) return null
  return (
    <p className="flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
      <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">Source:</span>{" "}
        {sources.map((s, i) => {
          const url = safeSourceUrl(s.url)
          return (
            <span key={i}>
              {i > 0 && "; "}
              {s.label}
              {url && (
                <>
                  {" "}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    View original source
                    <ExternalLink className="size-3" aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </>
              )}
            </span>
          )
        })}
      </span>
    </p>
  )
}

// Renders a Campus Agent answer: summary, steps, requirements, details,
// what the handbook doesn't cover, and the source line.
// variant="public" (landing page): no "Not covered by the handbook" box. Gaps are not
// filled in — the answer simply doesn't claim them — and partial answers end with a
// neutral pointer to the responsible office. The student chat keeps the full view.
const PUBLIC_CONFIRM_NOTE = "For exact procedures or office-specific instructions, please confirm with the responsible university office."

export function AnswerView({ answer, variant = "student" }: { answer: StructuredAnswer; variant?: "student" | "public" }) {
  const isPublic = variant === "public"
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
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2">
          <Info className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {answer.summary}
        </p>
        <CampusMapLink location={answer.location} />
        <AnswerLink link={answer.link} />
      </div>
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

      {answer.gaps && !isPublic && (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/60 px-3.5 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>
            <span className="font-medium">Not covered by the handbook: </span>
            {answer.gaps}
          </p>
        </div>
      )}

      <CampusMapLink location={answer.location} />
      <AnswerLink link={answer.link} />

      {isPublic && (answer.gaps || answer.status === "partial") && (
        <p className="text-sm text-muted-foreground">{PUBLIC_CONFIRM_NOTE}</p>
      )}

      <SourceLine sources={answer.sources} />
    </div>
  )
}
