"use client"

import { ArrowUp, LoaderCircle } from "lucide-react"
import { useId, useRef, useState } from "react"

import { cn } from "cn"

// Question input shared by the public landing page and the student chat.
// With `onAsk`, questions are sent to Campus Agent. Without it (public landing
// page, not connected yet), submitting shows `notConnectedMessage` instead of
// pretending to answer.
export function QuestionComposer({
  placeholder,
  suggestions = [],
  notConnectedMessage,
  onAsk,
  busy = false,
  size = "default",
  autoFocus = false,
}: {
  placeholder: string
  suggestions?: string[]
  notConnectedMessage?: string
  /** Sends the question; resolve `false` to keep the text (e.g. on error). */
  onAsk?: (question: string) => Promise<boolean>
  busy?: boolean
  size?: "default" | "large"
  autoFocus?: boolean
}) {
  const id = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) {
      textareaRef.current?.focus()
      return
    }
    if (!onAsk) {
      setStatus(notConnectedMessage ?? null)
      return
    }
    setValue("")
    const ok = await onAsk(question)
    if (!ok) setValue(question)
  }

  function applySuggestion(text: string) {
    if (onAsk) {
      void send(text)
      return
    }
    setValue(text)
    setStatus(null)
    const el = textareaRef.current
    if (el) {
      el.value = text
      resize(el)
      el.focus()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(value)
        }}
        className={cn(
          "group flex items-end gap-2 rounded-xl border border-input bg-background p-2 shadow-[0_1px_2px_oklch(0.22_0.025_262/0.06),0_4px_16px_-6px_oklch(0.22_0.025_262/0.12)] transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25",
          size === "large" && "p-2.5"
        )}
      >
        <label htmlFor={id} className="sr-only">
          Your question
        </label>
        <textarea
          ref={textareaRef}
          id={id}
          name="question"
          rows={1}
          value={value}
          autoFocus={autoFocus}
          maxLength={1000}
          placeholder={placeholder}
          aria-describedby={status ? `${id}-status` : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setStatus(null)
            resize(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send(value)
            }
          }}
          className={cn(
            "max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 leading-6 outline-none field-sizing-content placeholder:text-muted-foreground",
            size === "large" ? "text-base sm:text-lg" : "text-base"
          )}
        />
        <button
          type="submit"
          aria-label={busy ? "Waiting for answer" : "Ask"}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
            size === "large" ? "size-10" : "size-9"
          )}
          disabled={busy || !value.trim()}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-4" aria-hidden="true" />
          )}
        </button>
      </form>

      <p
        id={`${id}-status`}
        role="status"
        className={cn("text-sm text-muted-foreground", !status && "sr-only")}
      >
        {status}
      </p>

      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Example questions">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => applySuggestion(s)}
                disabled={busy}
                className="rounded-full border bg-background px-3 py-1.5 text-sm text-secondary-foreground transition-colors outline-none hover:border-ring/40 hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
