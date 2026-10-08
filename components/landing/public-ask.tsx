"use client"

import { CircleAlert, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { askPublic } from "@/app/actions"
import { AnswerView } from "@/components/assistant/answer-view"
import { QuestionComposer } from "@/components/assistant/question-composer"
import { buttonVariants } from "@/components/ui/button"
import type { StructuredAnswer } from "@/lib/ai/answer-types"

type Turn = { id: number; question: string; answer: StructuredAnswer | null; error: string | null }

const ERROR = "Campus Agent couldn't answer right now. Please try again."

function remainingLabel(n: number) {
  return `${n} free ${n === 1 ? "question" : "questions"} remaining`
}

// Landing-page ask box for incoming freshmen and visitors. Signed-out guests get a few
// free answers (counted on the server, only on success), then a friendly sign-up gate.
// This in-page chat is temporary: nothing is saved until the visitor has an account.
export function PublicAsk({ suggestions, initialRemaining }: { suggestions: string[]; initialRemaining: number | null }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState(initialRemaining)
  const limitReached = remaining === 0

  async function ask(question: string) {
    const id = Date.now()
    const update = (patch: Partial<Turn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    setBusy(true)
    setTurns((all) => [{ id, question, answer: null, error: null }, ...all])
    try {
      const result = await askPublic(question)
      setRemaining(result.remaining)
      if (result.ok) {
        update({ answer: result.answer })
      } else if (result.limitReached) {
        // The gate explains it; drop the unanswered question.
        setTurns((all) => all.filter((t) => t.id !== id))
      } else {
        update({ error: result.error })
      }
    } catch {
      update({ error: ERROR })
    } finally {
      setBusy(false)
    }
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      {limitReached ? (
        <SignupGate />
      ) : (
        <div className="flex flex-col gap-2">
          <QuestionComposer
            size="large"
            centerSuggestions
            placeholder="Ask about admission, enrollment, programs, or campus offices..."
            suggestions={turns.length === 0 ? suggestions : []}
            onAsk={ask}
            busy={busy}
          />
          {remaining !== null && turns.length > 0 && (
            <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
              {remainingLabel(remaining)}
            </p>
          )}
        </div>
      )}

      {turns.map((turn) => {
        const pending = !turn.answer && !turn.error
        return (
          <section
            key={turn.id}
            aria-label="Answer"
            aria-live="polite"
            aria-busy={pending}
            className="rounded-xl border bg-background p-5 text-left shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05)]"
          >
            <p className="text-sm font-medium text-muted-foreground">
              <span className="sr-only">You asked: </span>
              {turn.question}
            </p>
            <div className="mt-3 border-t pt-4 leading-relaxed">
              {pending ? (
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
                <AnswerView answer={turn.answer} variant="public" />
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function SignupGate() {
  return (
    <section aria-labelledby="signup-gate-heading" className="rounded-xl border bg-background p-5 text-left shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05)] sm:p-6">
      <h2 id="signup-gate-heading" className="font-semibold">
        Keep the conversation going
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        You’ve used your free questions. Create an account to continue using Campus Agent and save your conversations.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/signup" className={buttonVariants({ size: "lg", className: "px-4" })}>
          Create account
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg", className: "px-4" })}>
          Sign in
        </Link>
      </div>
    </section>
  )
}
