"use client"

import { Building2, CircleAlert, FileText, ListChecks } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { askCampusAgent } from "@/app/app/(shell)/chat/actions"
import { AnswerView } from "@/components/assistant/answer-view"
import { QuestionComposer } from "@/components/assistant/question-composer"
import { SimpleMarkdown } from "@/components/assistant/simple-markdown"
import { LogoMark } from "@/components/shared/logo"
import type { ChatMessage } from "@/lib/ai/chat-types"

const ANSWER_PARTS = [
  { icon: ListChecks, label: "Steps and requirements" },
  { icon: Building2, label: "Responsible office, when the handbook names one" },
  { icon: FileText, label: "The handbook page it came from" },
]

export function ChatView({
  conversationId,
  initialMessages,
  assistantName,
  firstName,
  suggestions,
}: {
  conversationId: string | null
  initialMessages: ChatMessage[]
  assistantName: string
  firstName: string | null
  suggestions: string[]
}) {
  // Set after the first answer so follow-ups stay in the same conversation.
  const [activeConversationId, setActiveConversationId] = useState(conversationId)
  const [messages, setMessages] = useState(initialMessages)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length || pendingQuestion) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, pendingQuestion])

  async function ask(question: string) {
    setError(null)
    setPendingQuestion(question)
    try {
      const result = await askCampusAgent(activeConversationId, question)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      // A new conversation started from an existing one (e.g. a stale tab after switching
      // accounts) replaces the old messages instead of appending to them.
      const switched = result.isNew && activeConversationId !== null
      setMessages((m) => (switched ? [result.user, result.assistant] : [...m, result.user, result.assistant]))
      if (result.isNew) {
        setActiveConversationId(result.conversationId)
        // Update the address without re-rendering, so the chat stays in place.
        window.history.replaceState(null, "", `/app/chat/${result.conversationId}`)
      }
      return true
    } catch {
      setError("Campus Agent could not complete this request right now. Please try again.")
      return false
    } finally {
      setPendingQuestion(null)
    }
  }

  const busy = pendingQuestion !== null
  const empty = messages.length === 0 && !busy

  // The chat is the focused workspace: it sits on white rather than the shell's canvas.
  if (empty) {
    return (
      <div className="flex flex-1 flex-col bg-background">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:py-16">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.1rem]">
            {firstName ? `What do you need help with, ${firstName}?` : "What do you need help with?"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ask about enrollment, grades, documents, transfers, or other school procedures.
          </p>
          <div className="mt-8">
            <QuestionComposer
              size="large"
              autoFocus
              placeholder={`Ask ${assistantName}…`}
              suggestions={suggestions}
              onAsk={ask}
              busy={busy}
            />
          </div>
          {error && <ErrorNote message={error} />}
          <div className="mt-12 border-t pt-6">
            <p className="text-sm font-medium">Every answer is built to show</p>
            <ul className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              {ANSWER_PARTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <ol className="flex flex-col gap-8" aria-label="Conversation">
          {messages.map((m) => (
            <li key={m.id}>{m.role === "user" ? <UserBubble text={m.content} /> : <AssistantTurn message={m} assistantName={assistantName} />}</li>
          ))}
          {pendingQuestion && (
            <>
              <li>
                <UserBubble text={pendingQuestion} />
              </li>
              <li>
                <Thinking assistantName={assistantName} />
              </li>
            </>
          )}
        </ol>
        {error && <ErrorNote message={error} />}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <QuestionComposer placeholder={`Ask a follow-up question…`} onAsk={ask} busy={busy} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Answers come from the official student handbook. Confirm important details with the responsible office.
          </p>
        </div>
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 whitespace-pre-wrap text-accent-foreground">
        <span className="sr-only">You asked: </span>
        {text}
      </p>
    </div>
  )
}

function AssistantTurn({ message, assistantName }: { message: ChatMessage; assistantName: string }) {
  return (
    <article className="flex gap-3" aria-label={`${assistantName} answer`}>
      <AssistantMark />
      <div className="min-w-0 flex-1 pt-0.5 leading-relaxed">
        {message.answer ? <AnswerView answer={message.answer} /> : <SimpleMarkdown text={message.content} />}
      </div>
    </article>
  )
}

function Thinking({ assistantName }: { assistantName: string }) {
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <AssistantMark />
      <div className="pt-1.5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-primary/70"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </span>
          {assistantName} is checking the handbook…
        </p>
      </div>
    </div>
  )
}

function AssistantMark() {
  return (
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      <LogoMark size={22} />
    </span>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
