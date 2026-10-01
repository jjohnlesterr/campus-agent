"use client"

import { CircleAlert, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { askPublic } from "@/app/actions"
import { AnswerView } from "@/components/assistant/answer-view"
import { QuestionComposer } from "@/components/assistant/question-composer"
import type { StructuredAnswer } from "@/lib/ai/answer-types"

type Turn = { question: string; answer: StructuredAnswer | null; error: string | null }

// Public ask box: general information for applicants, incoming students and visitors.
// Enter or the send button submits; the answer appears below without leaving the page.
export function PublicAsk({ suggestions }: { suggestions: string[] }) {
  const [turn, setTurn] = useState<Turn | null>(null)
  const [busy, setBusy] = useState(false)

  async function ask(question: string) {
    setBusy(true)
    setTurn({ question, answer: null, error: null })
    try {
      const result = await askPublic(question)
      setTurn(result.ok ? { question, answer: result.answer, error: null } : { question, answer: null, error: result.error })
    } catch {
      setTurn({ question, answer: null, error: "Campus Agent couldn't answer right now. Please try again." })
    } finally {
      setBusy(false)
    }
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <QuestionComposer
        size="large"
        placeholder="Ask about admission, enrollment, programs, or campus offices..."
        suggestions={suggestions}
        onAsk={ask}
        busy={busy}
      />

      {turn && (
        <section aria-label="Answer" aria-live="polite" aria-busy={busy} className="rounded-xl border bg-background p-5 text-left shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05)]">
          <p className="text-sm font-medium text-muted-foreground">
            <span className="sr-only">You asked: </span>
            {turn.question}
          </p>
          <div className="mt-3 border-t pt-4 leading-relaxed">
            {busy ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Checking verified university sources…
              </p>
            ) : turn.error ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {turn.error}
              </p>
            ) : turn.answer ? (
              <AnswerView answer={turn.answer} />
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
