"use client"

import { Building2, FileText, ListChecks, LoaderCircle } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { AnswerView } from "@/components/assistant/answer-view"
import { QuestionComposer } from "@/components/assistant/question-composer"
import { LogoMark } from "@/components/shared/logo"
import { StudentShell } from "@/components/student/student-shell"
import type { StructuredAnswer } from "@/lib/ai/answer-types"

// Demo only (/demo/inc-walkthrough, `next dev` only). A scripted, offline recreation of the
// student chat for the product video: the real shell, composer and answer components, driven
// by one clock `t` (seconds) so every frame is deterministic. Nothing here calls Anthropic or
// Supabase or stores a conversation. The answer is copied word for word from a real answer in
// the production app (INC question, 2026-10-23); do not edit it into new content.
//
// ?record=1 disables autoplay and exposes window.__demoSeek(t) for scripts/demo/record-inc-walkthrough.mjs.
// Otherwise it plays once on load; press R to replay.

const ASSISTANT_NAME = "CECT Agent"
const DEMO_USER = { name: "Juan Dela Cruz", detail: "student@example.edu" }
const DEMO_CONVERSATION = { id: "demo-inc-walkthrough", title: "Paano mag-ayos ng INC?" }
const QUESTION = DEMO_CONVERSATION.title

// Same as the New conversation page (app/app/(shell)/page.tsx).
const QUICK_QUESTIONS = [
  "How do I enroll as a freshman?",
  "What are the transferee requirements?",
  "What scholarships are available?",
  "Where is the Registrar?",
  "What programs are offered?",
  "What are the latest announcements?",
]

const ANSWER_PARTS = [
  { icon: ListChecks, label: "Steps and requirements" },
  { icon: Building2, label: "Responsible office, when the handbook names one" },
  { icon: FileText, label: "The handbook page it came from" },
]

const ANSWER: StructuredAnswer = {
  status: "answered",
  summary:
    "Para maayos ang 'Incomplete' (INC) grade, kailangan mo itong i-complete sa loob ng isang (1) taon, at may completion fee na babayaran.",
  steps: [],
  requirements: [
    "Kumpletuhin ang kulang na requirement o final exam sa loob ng isang (1) academic year.",
    "Magbayad ng completion fee.",
    "Kung ang INC ay dahil sa 'No Permit', maaari itong kumpletuhin sa mahigit isang (1) school year.",
  ],
  details: [
    "- Kung hindi makumpleto sa loob ng grace period, ang INC ay awtomatikong magiging 'Failed' (grade of 5).",
    "- Hindi tatanggapin ang completion grades na pinirmahan ng mga propesor na wala nang koneksyon sa Wesleyan University-Philippines — kailangang pumunta sa kani-kanilang dekano ang mga estudyanteng magkukumpleto ng grado.",
  ].join("\n"),
  gaps: "",
  sources: [
    { label: "WUP Handbook -Section 1 — Pages 4, 5", documentTitle: "WUP Handbook -Section 1", pageNumber: 4, sectionTitle: null },
    { label: "WUP Handbook -Section 1 — Page 2", documentTitle: "WUP Handbook -Section 1", pageNumber: 2, sectionTitle: null },
  ],
}

// Timeline (seconds). Narration cues are in scripts/demo/README.md.
export const DURATION = 18
const FOCUS_AT = 1.45
const TYPE_START = 1.75
const TYPE_END = 4.45
const CLICKS = [1.4, 5.4]
const SEND_AT = 5.55
const THINK_AT = 5.9
const ANSWER_AT = 8.75
// Answer parts, in order: summary, Requirements + 3 items, Good to know + 2 items, source line.
const REVEAL_AT = [8.75, 9.55, 9.85, 10.35, 10.85, 11.6, 11.9, 12.45, 13.25]

// Fixed, slightly uneven key gaps (longer after spaces) scaled to the typing window.
const KEY_TIMES = (() => {
  const gaps = [...QUESTION].map((ch, i) => 1 + ((i * 7) % 5) * 0.12 + (ch === " " ? 0.35 : 0))
  const total = gaps.reduce((a, b) => a + b, 0)
  let acc = 0
  return gaps.map((g) => TYPE_START + ((acc += g) / total) * (TYPE_END - TYPE_START))
})()

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeOut = (p: number) => 1 - (1 - p) ** 3
const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)
const typedText = (t: number) => QUESTION.slice(0, KEY_TIMES.filter((k) => k <= t).length)

type Point = { x: number; y: number }
type Layout = {
  start: Point
  input: Point
  aside: Point
  send: Point
  caret: { left: number; top: number; height: number; font: string }
}

// Cursor keyframes: [time, point]. Holds at the last point.
const PATH: [number, keyof Omit<Layout, "caret">][] = [
  [0, "start"],
  [0.5, "start"],
  [1.3, "input"],
  [1.8, "input"],
  [2.4, "aside"],
  [4.55, "aside"],
  [5.3, "send"],
]

function cursorAt(t: number, layout: Layout): Point {
  for (let i = 1; i < PATH.length; i++) {
    const [t1, k1] = PATH[i]
    if (t <= t1) {
      const [t0, k0] = PATH[i - 1]
      const p = easeInOut(seg(t, t0, t1))
      const a = layout[k0]
      const b = layout[k1]
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }
    }
  }
  return layout[PATH[PATH.length - 1][1]]
}

let measureCanvas: HTMLCanvasElement | null = null
function textWidth(text: string, font: string) {
  measureCanvas ??= document.createElement("canvas")
  const ctx = measureCanvas.getContext("2d")
  if (!ctx) return 0
  ctx.font = font
  return ctx.measureText(text).width
}

declare global {
  interface Window {
    __demoSeek?: (t: number) => Promise<void>
    __demoReady?: boolean
  }
}

export function IncWalkthrough() {
  const [t, setT] = useState(0)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [record, setRecord] = useState(false)
  const composerRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const sendButtonRef = useRef<HTMLButtonElement | null>(null)
  const submitted = t >= SEND_AT

  // Measure the empty-state composer once fonts are loaded, then autoplay or wait for the recorder.
  useEffect(() => {
    const isRecord = new URLSearchParams(window.location.search).has("record")
    const homePath = window.location.pathname + window.location.search
    let frame = 0
    let cancelled = false

    function measure() {
      const form = composerRef.current?.querySelector("form")
      const textarea = form?.querySelector("textarea")
      const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]')
      if (!form || !textarea || !button) return
      sendButtonRef.current = button
      const f = form.getBoundingClientRect()
      const ta = textarea.getBoundingClientRect()
      const b = button.getBoundingClientRect()
      const style = getComputedStyle(textarea)
      const lineHeight = parseFloat(style.lineHeight)
      const fontSize = parseFloat(style.fontSize)
      setLayout({
        start: { x: window.innerWidth * 0.8, y: window.innerHeight * 0.86 },
        input: { x: ta.left + 150, y: ta.top + ta.height / 2 },
        aside: { x: f.right + 70, y: f.top + f.height + 40 },
        send: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
        caret: {
          left: ta.left + parseFloat(style.paddingLeft),
          top: ta.top + parseFloat(style.paddingTop) + (lineHeight - fontSize * 1.2) / 2,
          height: fontSize * 1.2,
          font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
        },
      })
    }

    function play() {
      const startedAt = performance.now()
      cancelAnimationFrame(frame)
      const tick = () => {
        const now = Math.min(DURATION, (performance.now() - startedAt) / 1000)
        setT(now)
        if (now < DURATION) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "r" || isRecord) return
      setT(0)
      play()
    }

    void document.fonts.ready.then(() => {
      if (cancelled) return
      setRecord(isRecord)
      window.history.replaceState(null, "", "/app")
      measure()
      if (isRecord) {
        window.__demoSeek = async (next: number) => {
          flushSync(() => setT(next))
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        }
        window.__demoReady = true
      } else {
        window.setTimeout(play, 400)
      }
    })
    window.addEventListener("keydown", onKey)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKey)
      window.history.replaceState(null, "", homePath)
      delete window.__demoSeek
      delete window.__demoReady
    }
  }, [])

  // The real app moves to /app/chat/<id> after the first answer; the sidebar highlights it from the path.
  useEffect(() => {
    if (!layout) return
    window.history.replaceState(null, "", submitted ? `/app/chat/${DEMO_CONVERSATION.id}` : "/app")
  }, [submitted, layout])

  // Drive the real composer: typed text (through React's onChange), focus and the Send press.
  useLayoutEffect(() => {
    if (submitted) return
    const textarea = composerRef.current?.querySelector("textarea")
    if (!textarea) return
    const text = typedText(t)
    if (textarea.value !== text) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, text)
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
    }
    if (t >= FOCUS_AT && document.activeElement !== textarea) textarea.focus({ preventScroll: true })
    if (t < FOCUS_AT && document.activeElement === textarea) textarea.blur()
    const button = sendButtonRef.current
    if (button) button.style.transform = t >= CLICKS[1] && t < SEND_AT ? "scale(0.95)" : ""
  }, [t, submitted])

  // Staggered answer reveal over the real AnswerView markup (layout stays fixed, nothing jumps).
  useLayoutEffect(() => {
    const root = answerRef.current?.firstElementChild
    if (!root) return
    const [summary, requirements, details] = Array.from(root.children)
    const parts = [
      summary,
      requirements?.querySelector("h3"),
      ...Array.from(requirements?.querySelectorAll("li") ?? []),
      details?.querySelector("h3"),
      ...Array.from(details?.querySelectorAll("li") ?? []),
      root.lastElementChild,
    ]
    parts.forEach((el, i) => {
      if (!(el instanceof HTMLElement)) return
      const p = easeOut(seg(t, REVEAL_AT[i] ?? ANSWER_AT, (REVEAL_AT[i] ?? ANSWER_AT) + 0.45))
      el.style.opacity = String(p)
      el.style.transform = p < 1 ? `translateY(${(1 - p) * 6}px)` : ""
    })
  }, [t])

  const recent = submitted ? [DEMO_CONVERSATION] : []
  const spin = `${(t * 400) % 360}deg`

  return (
    <StudentShell assistantName={ASSISTANT_NAME} user={DEMO_USER} recentConversations={recent}>
      <div className="demo-stage flex flex-1 flex-col" style={{ "--demo-spin": spin } as React.CSSProperties}>
        {/* Spinners follow the demo clock; the caret is drawn by the overlay. */}
        <style>{`.demo-stage .animate-spin{animation:none!important;transform:rotate(var(--demo-spin))}.demo-stage textarea{caret-color:transparent}${record ? "nextjs-portal{display:none!important}" : ""}`}</style>
        {submitted ? <Conversation t={t} answerRef={answerRef} /> : <EmptyState composerRef={composerRef} />}
      </div>
      {layout && <Overlay t={t} layout={layout} />}
    </StudentShell>
  )
}

/** ChatView's empty state (New conversation), with the real composer. */
function EmptyState({ composerRef }: { composerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.1rem]">What do you need help with, Juan?</h1>
        <p className="mt-2 text-muted-foreground">Ask about enrollment, grades, documents, transfers, or other school procedures.</p>
        <div ref={composerRef} className="mt-8">
          <QuestionComposer
            size="large"
            placeholder={`Ask ${ASSISTANT_NAME}…`}
            suggestions={QUICK_QUESTIONS}
            centerSuggestions="full"
            onAsk={async () => false}
          />
        </div>
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

/** ChatView's conversation layout: question, "checking sources", then the answer. */
function Conversation({ t, answerRef }: { t: number; answerRef: React.RefObject<HTMLDivElement | null> }) {
  const thinking = t >= THINK_AT && t < ANSWER_AT
  const bubble = easeOut(seg(t, SEND_AT, SEND_AT + 0.3))
  const mark = easeOut(seg(t, THINK_AT, THINK_AT + 0.3))
  const thinkingText = mark * (1 - seg(t, ANSWER_AT - 0.25, ANSWER_AT))

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <ol className="flex flex-col gap-8" aria-label="Conversation">
          <li style={{ opacity: bubble, transform: `translateY(${(1 - bubble) * 8}px)` }}>
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 whitespace-pre-wrap text-accent-foreground">
                <span className="sr-only">You asked: </span>
                {QUESTION}
              </p>
            </div>
          </li>
          {t >= THINK_AT && (
            <li>
              {t < ANSWER_AT ? (
                <div className="flex gap-3" role="status" aria-live="polite">
                  <AssistantMark opacity={mark} />
                  <div className="pt-1.5" style={{ opacity: thinkingText }}>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 shrink-0 animate-spin text-primary/70" aria-hidden="true" />
                      {ASSISTANT_NAME} is checking university sources…
                    </p>
                  </div>
                </div>
              ) : (
                <article className="flex gap-3" aria-label={`${ASSISTANT_NAME} answer`}>
                  <AssistantMark opacity={1} />
                  <div ref={answerRef} className="min-w-0 flex-1 pt-0.5 leading-relaxed">
                    <AnswerView answer={ANSWER} />
                  </div>
                </article>
              )}
            </li>
          )}
        </ol>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <QuestionComposer placeholder="Ask a follow-up question…" onAsk={async () => false} busy={thinking} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Answers come from published university sources. Confirm important details with the responsible office.
          </p>
        </div>
      </div>
    </div>
  )
}

function AssistantMark({ opacity }: { opacity: number }) {
  return (
    <span className="mt-0.5 shrink-0" aria-hidden="true" style={{ opacity }}>
      <LogoMark size={22} />
    </span>
  )
}

/** Mouse cursor, click ripples and the text caret, positioned from the measured layout. */
function Overlay({ t, layout }: { t: number; layout: Layout }) {
  const { x, y } = cursorAt(t, layout)
  const opacity = seg(t, 0.15, 0.55) * (1 - seg(t, 5.95, 6.45))
  const pressed = CLICKS.some((c) => t >= c && t < c + 0.16)

  const focused = t >= FOCUS_AT && t < SEND_AT
  const typing = t >= TYPE_START - 0.1 && t <= TYPE_END + 0.35
  const caretOn = focused && (typing || Math.floor((t - FOCUS_AT) * 2) % 2 === 0)
  const caretX = layout.caret.left + textWidth(typedText(t), layout.caret.font) + 1

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      {caretOn && (
        <span
          className="absolute w-px bg-foreground"
          style={{ left: caretX, top: layout.caret.top, height: layout.caret.height }}
        />
      )}
      {CLICKS.map((c) => {
        const p = seg(t, c, c + 0.45)
        if (p <= 0 || p >= 1) return null
        const r = 6 + p * 16
        return (
          <span
            key={c}
            className="absolute rounded-full border-2 border-primary"
            style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, opacity: 0.35 * (1 - p) }}
          />
        )
      })}
      {opacity > 0 && (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="absolute drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
          style={{ left: x - 4, top: y - 2, opacity, transform: pressed ? "scale(0.88)" : undefined, transformOrigin: "4px 2px" }}
        >
          <path d="M4.5 2.5v16.2l4.1-3.9 2.7 6.2 2.6-1.1-2.7-6.1h5.7z" fill="#111827" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}
