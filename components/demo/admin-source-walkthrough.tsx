"use client"

import type { LucideIcon } from "lucide-react"
import {
  Building2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  FileUp,
  Library,
  LoaderCircle,
  Map as MapIcon,
  Megaphone,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Upload,
  Users,
  XIcon,
} from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { cn } from "cn"

import { AdminShell } from "@/components/admin/admin-shell"
import { CollectionCard } from "@/components/admin/collection-card"
import { CollectionMenu, CreateCollectionButton } from "@/components/admin/collection-dialogs"
import { SourceActions } from "@/components/admin/source-actions"
import { SourceSections } from "@/components/admin/source-sections"
import { DEMO_PDF, DEMO_SECTIONS } from "@/components/demo/admin-source-data"
import { EmptyState } from "@/components/shared/empty-state"
import { Field, textareaClass } from "@/components/shared/form-field"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CollectionSummary } from "@/lib/knowledge/collections"
import { LIBRARY_TABS } from "@/lib/knowledge/library"
import type { SectionStatus, SourceSection } from "@/lib/knowledge/sections"
import { pageLabel } from "@/lib/knowledge/topics"
import { formatFileSize } from "@/lib/sources"

// Demo only (/demo/admin-sources, `next dev` only). A scripted, offline recreation of the admin
// Knowledge Library workflow for the product video: Dashboard → Knowledge Library → Student
// Handbook → Add source → Upload PDF → Analyze with AI → review → Publish drafts. One clock
// `t` (seconds) drives every frame. Nothing here uploads, analyzes, stores or publishes:
// no Anthropic or Supabase calls. Section text comes from admin-source-data.ts (generated
// from the local PDF with the app's own extraction and slicing).
//
// ?record=1 disables autoplay and exposes window.__demoSeek(t) for scripts/demo/record-inc-walkthrough.mjs --demo admin.
// Otherwise it plays once on load; press R to replay.

const ASSISTANT_NAME = "CECT Agent"
const ADMIN = { name: "Ana Reyes", email: "admin@example.edu" }
const COLLECTION = { id: "3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c1d", name: "Student Handbook", description: "Official handbook and academic rules used by CECT Agent." }
const SOURCE_ID = "8a1d4c7e-2b3f-4a5e-9d6c-1e2f3a4b5c6d"
const TODAY = "Oct 23, 2026"
const NOW_ISO = "2026-10-23T01:41:00.000Z"
const TIMEZONE = "Asia/Manila"
/** titleFromFileName("Information-WUP.pdf"), as the real uploader fills it in. */
const FILE_TITLE = "Information WUP"
/** The PDF's own first line, typed by the admin as the citation title. */
const SOURCE_TITLE = "Student Handbook — Key Information"
// Illustrative AI overview, limited to what the PDF's own headings cover.
const OVERVIEW = {
  summary:
    "Key information from the Student Handbook of Wesleyan University–Philippines: enrollment, INC grades, graduation, withdrawal, shifting and transfer, scholarships, document requests, academic rules, dress code and violations, with the Calendar of Activities, colleges and academic programs, and annual college events for A.Y. 2026–2027.",
  topics: ["Enrollment", "INC / Incomplete grades", "Scholarships", "Document requests", "Academic rules", "Dress code", "Calendar of Activities", "Colleges and programs"],
}

export const DURATION = 34
// Timeline (seconds). Narration cues are in scripts/demo/README.md.
const T = {
  library: 1.9,
  collection: 3.6,
  chooserOpen: 5.05,
  uploadOpen: 6.25,
  chipIn: 7.05,
  dragOver: 7.95,
  drop: 8.45,
  titleFocus: 9.45,
  typeStart: 9.9,
  typeEnd: 12.0,
  uploadClick: 13.0,
  source: 14.3,
  analyzeOpen: 15.85,
  analyzeClick: 17.0,
  analyzed: 19.6,
  confirmOpen: 27.45,
  confirmClick: 28.75,
  published: 29.5,
}
const CLICKS: [number, string][] = [
  [1.75, "nav-knowledge"],
  [3.45, "collection-card"],
  [4.95, "add-source"],
  [6.15, "upload-option"],
  [9.4, "title-input"],
  [T.uploadClick, "upload-submit"],
  [15.75, "analyze"],
  [T.analyzeClick, "start-analysis"],
  [27.35, "publish-drafts"],
  [T.confirmClick, "confirm-publish"],
]
// Cursor keyframes [time, target]; "@x,y" is a fixed viewport point (fractions), e.g. while scrolling.
const CURSOR: [number, string][] = [
  [0, "@0.62,0.55"], [0.4, "@0.62,0.55"], [1.6, "nav-knowledge"], [2.3, "nav-knowledge"],
  [3.3, "collection-card"], [3.9, "collection-card"], [4.8, "add-source"], [5.3, "add-source"],
  [6.0, "upload-option"], [6.45, "upload-option"], [7.05, "@0.9,0.86"], [7.25, "@0.9,0.86"],
  [8.3, "dropzone"], [8.75, "dropzone"], [9.3, "title-input"], [12.2, "title-input"],
  [12.9, "upload-submit"], [14.6, "@0.66,0.42"], [15.6, "analyze"], [16.2, "analyze"],
  [16.9, "start-analysis"], [19.8, "start-analysis"], [20.6, "@0.6,0.56"], [22.4, "@0.6,0.56"],
  [23.4, "@0.68,0.44"], [25.4, "@0.64,0.62"], [27.2, "publish-drafts"], [27.8, "publish-drafts"],
  [28.6, "confirm-publish"], [29.7, "confirm-publish"], [30.6, "@0.74,0.62"],
]
// Page scroll keyframes on the source page [time, anchor].
const SCROLL: [number, string][] = [
  [0, "top"], [20.3, "top"], [22.0, "sections"], [22.6, "sections"], [25.6, "section-3"], [26.0, "section-3"],
  [26.9, "sections"], [30.6, "sections"], [31.9, "top"],
]
const CURSOR_OUT = [31.3, 31.8] as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeOut = (p: number) => 1 - (1 - p) ** 3
const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

const KEY_TIMES = (() => {
  const gaps = [...SOURCE_TITLE].map((ch, i) => 1 + ((i * 7) % 5) * 0.12 + (ch === " " ? 0.3 : 0))
  const total = gaps.reduce((a, b) => a + b, 0)
  let acc = 0
  return gaps.map((g) => T.typeStart + ((acc += g) / total) * (T.typeEnd - T.typeStart))
})()

function titleAt(t: number) {
  if (t < T.drop) return ""
  if (t < T.typeStart) return FILE_TITLE
  return SOURCE_TITLE.slice(0, KEY_TIMES.filter((k) => k <= t).length)
}

function sceneAt(t: number) {
  if (t < T.library) return "dashboard" as const
  if (t < T.collection) return "library" as const
  if (t < T.source) return "collection" as const
  return "source" as const
}

const PATHS = {
  dashboard: "/admin",
  library: "/admin/knowledge",
  collection: `/admin/knowledge/collections/${COLLECTION.id}`,
  source: `/admin/documents/${SOURCE_ID}`,
}

/** Open/close progress of a dialog shown between `open` and `close`. */
function dialogProgress(t: number, open: number, close: number) {
  if (t < open || t >= close + 0.12) return 0
  return easeOut(seg(t, open, open + 0.15)) * (1 - seg(t, close, close + 0.12))
}

const SECTIONS_AT = (status: SectionStatus): SourceSection[] =>
  DEMO_SECTIONS.map((s, i) => ({
    id: s.id,
    title: s.title,
    content: s.content,
    status,
    pages: [...s.pages],
    pageLabel: pageLabel([...s.pages]),
    sourceOrder: i + 1,
    sortOrder: null,
    steps: [],
    requirements: [...s.requirements],
    tableReview: s.tableReview,
    procedureReview: s.procedureReview,
    updatedAt: NOW_ISO,
    createdAt: NOW_ISO,
  }))
const DRAFTS = SECTIONS_AT("draft")
const PUBLISHED = SECTIONS_AT("published")

declare global {
  interface Window {
    __demoSeek?: (t: number) => Promise<void>
    __demoReady?: boolean
  }
}

type Point = { x: number; y: number }

/** Where a cursor target is on screen right now (or where it last was). */
function locate(name: string, cache: Map<string, Point>): Point {
  if (name.startsWith("@")) {
    const [fx, fy] = name.slice(1).split(",").map(Number)
    return { x: window.innerWidth * fx, y: window.innerHeight * fy }
  }
  const el = targetElement(name)
  if (el) {
    const r = el.getBoundingClientRect()
    const offsetX = name === "nav-knowledge" || name === "collection-card" ? Math.min(70, r.width / 2) : name === "title-input" ? r.width * 0.72 : r.width / 2
    const point = { x: r.left + offsetX, y: r.top + r.height / 2 }
    cache.set(name, point)
    return point
  }
  return cache.get(name) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function targetElement(name: string): HTMLElement | null {
  if (name === "nav-knowledge") return document.querySelector<HTMLElement>('aside a[href="/admin/knowledge"]')
  if (name === "collection-card") return document.querySelector<HTMLElement>(`a[href="${PATHS.collection}"]`)
  if (name === "publish-drafts") return [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith("Publish drafts")) ?? null
  return document.querySelector<HTMLElement>(`[data-demo="${name}"]`)
}

function scrollAnchor(name: string) {
  if (name === "top") return 0
  const el =
    name === "sections"
      ? document.querySelector('[aria-labelledby="sections-heading"]')
      : document.querySelectorAll('[aria-label="Knowledge sections"] > li')[2]
  if (!el) return 0
  return el.getBoundingClientRect().top + window.scrollY - (name === "sections" ? 24 : 120)
}

function interpolate<T>(t: number, frames: [number, T][], at: (v: T) => number) {
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const p = easeInOut(seg(t, frames[i - 1][0], frames[i][0]))
      const a = at(frames[i - 1][1])
      return a + (at(frames[i][1]) - a) * p
    }
  }
  return at(frames[frames.length - 1][1])
}

let measureCanvas: HTMLCanvasElement | null = null
function textWidth(text: string, font: string) {
  measureCanvas ??= document.createElement("canvas")
  const ctx = measureCanvas.getContext("2d")
  if (!ctx) return 0
  ctx.font = font
  return ctx.measureText(text).width
}

export function AdminSourceWalkthrough() {
  const [t, setT] = useState(0)
  const [ready, setReady] = useState(false)
  const [record, setRecord] = useState(false)
  const cache = useRef(new Map<string, Point>())
  const cursorRef = useRef<SVGSVGElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const scene = sceneAt(t)

  useEffect(() => {
    const isRecord = new URLSearchParams(window.location.search).has("record")
    const homePath = window.location.pathname + window.location.search
    let frame = 0
    let cancelled = false

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
      setReady(true)
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

  // The sidebar highlights from the path, as on the real pages.
  useEffect(() => {
    if (ready) window.history.replaceState(null, "", PATHS[scene])
  }, [scene, ready])

  // Per frame: page scroll, title field focus/selection, pressed buttons, then the overlay.
  useLayoutEffect(() => {
    if (!ready) return
    const y = scene === "source" ? interpolate(t, SCROLL, scrollAnchor) : 0
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.max(0, Math.min(max, Math.round(y))))

    const title = document.querySelector<HTMLInputElement>('[data-demo="title-input"]')
    const editing = t >= T.titleFocus && t < T.uploadClick
    if (title) {
      if (editing && document.activeElement !== title) title.focus({ preventScroll: true })
      if (!editing && document.activeElement === title) title.blur()
      if (editing && t < T.typeStart) title.setSelectionRange(0, title.value.length)
    }

    for (const [at, name] of CLICKS) {
      const el = targetElement(name)
      if (el) el.style.transform = t >= at && t < at + 0.15 ? "scale(0.97)" : ""
    }

    const x = interpolate(t, CURSOR, (n) => locate(n, cache.current).x)
    const yCursor = interpolate(t, CURSOR, (n) => locate(n, cache.current).y)
    const visible = seg(t, 0.15, 0.5) * (1 - seg(t, CURSOR_OUT[0], CURSOR_OUT[1]))
    const pressed = CLICKS.some(([c]) => t >= c && t < c + 0.15)
    const cursor = cursorRef.current
    if (cursor) {
      cursor.style.transform = `translate(${x - 4}px, ${yCursor - 2}px)${pressed ? " scale(0.88)" : ""}`
      cursor.style.opacity = String(visible)
    }
    const ring = ringRef.current
    if (ring) {
      const click = CLICKS.find(([c]) => t >= c && t < c + 0.45)
      const p = click ? seg(t, click[0], click[0] + 0.45) : 0
      const r = 6 + p * 16
      ring.style.opacity = click ? String(0.35 * (1 - p)) : "0"
      Object.assign(ring.style, { left: `${x - r}px`, top: `${yCursor - r}px`, width: `${r * 2}px`, height: `${r * 2}px` })
    }
    const chip = chipRef.current
    if (chip) {
      const show = t >= T.chipIn && t < T.drop
      chip.style.opacity = show ? String(0.92 * seg(t, T.chipIn, T.chipIn + 0.2)) : "0"
      chip.style.transform = `translate(${x + 14}px, ${yCursor + 16}px)`
    }
    const caret = caretRef.current
    if (caret) {
      const on = title && editing && t >= T.typeStart && (t <= T.typeEnd + 0.2 || Math.floor((t - T.typeEnd) * 2) % 2 === 1)
      if (on && title) {
        const r = title.getBoundingClientRect()
        const style = getComputedStyle(title)
        const fontSize = parseFloat(style.fontSize)
        const left = r.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) + textWidth(title.value, `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`)
        Object.assign(caret.style, { display: "block", left: `${left + 0.5}px`, top: `${r.top + (r.height - fontSize * 1.25) / 2}px`, height: `${fontSize * 1.25}px` })
      } else {
        caret.style.display = "none"
      }
    }
  }, [t, ready, scene])

  const spin = `${(t * 400) % 360}deg`

  return (
    <AdminShell assistantName={ASSISTANT_NAME} userName={ADMIN.name} userEmail={ADMIN.email}>
      <div className="demo-stage" style={{ "--demo-spin": spin } as React.CSSProperties}>
        {/* Spinners follow the demo clock; the caret is drawn by the overlay. */}
        <style>{`.demo-stage .animate-spin,.demo-overlay-root .animate-spin{animation:none!important;transform:rotate(var(--demo-spin))}.demo-overlay-root{--demo-spin:${spin}}[data-demo="title-input"]{caret-color:transparent}${record ? "nextjs-portal{display:none!important}*,*::before,*::after{transition-duration:0s!important}" : ""}`}</style>
        {scene === "dashboard" && <Dashboard />}
        {scene === "library" && <LibraryRoot />}
        {scene === "collection" && <CollectionPage />}
        {scene === "source" && <SourcePage t={t} />}
      </div>
      <div className="demo-overlay-root">
        {scene === "collection" && <AddSourceDialog t={t} />}
        {scene === "collection" && <UploadDialog t={t} />}
        {scene === "source" && <AnalyzeDialog t={t} />}
        {scene === "source" && <PublishDialog t={t} />}
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]">
        <span ref={caretRef} className="absolute hidden w-px bg-foreground" />
        <span ref={ringRef} className="absolute rounded-full border-2 border-primary opacity-0" />
        <div ref={chipRef} className="absolute top-0 left-0 flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium opacity-0 shadow-md">
          <FileText className="size-4 text-primary" aria-hidden="true" />
          {DEMO_PDF.fileName}
        </div>
        <svg ref={cursorRef} width="24" height="24" viewBox="0 0 24 24" className="absolute top-0 left-0 opacity-0 drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]" style={{ transformOrigin: "4px 2px" }}>
          <path d="M4.5 2.5v16.2l4.1-3.9 2.7 6.2 2.6-1.1-2.7-6.1h5.7z" fill="#111827" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </div>
    </AdminShell>
  )
}

// ---------- Dashboard (app/admin/page.tsx markup, demo records) ----------

type Readiness = { label: string; status: "ready" | "review"; detail: string; icon: LucideIcon }

const METRICS: { label: string; value: number; note: string; icon: LucideIcon }[] = [
  { label: "Published Knowledge", value: 0, note: "Available to CECT Agent", icon: Library },
  { label: "Ready Sources", value: 0, note: "Processed and available", icon: FileText },
  { label: "Users", value: 0, note: "Registered accounts", icon: Users },
  { label: "Published Announcements", value: 0, note: "University-wide notices", icon: Megaphone },
]
// Departments and programs as listed in the demo PDF (8 colleges, 19 named programs).
const READINESS: Readiness[] = [
  { label: "Knowledge Library", status: "review", detail: "No published sections yet", icon: Library },
  { label: "Sources", status: "review", detail: "No processed sources yet", icon: FileText },
  { label: "Departments", status: "ready", detail: "8 departments · 19 programs", icon: Building2 },
  { label: "Campus Map", status: "review", detail: "No map image · 0 buildings · 0 locations", icon: MapIcon },
  { label: "Announcements", status: "ready", detail: "0 published", icon: Megaphone },
]
const UPDATES = [
  { action: "Department created", title: "College of Engineering and Computer Technology (CECT)", at: "Oct 22, 2026 · 4:15 PM" },
  { action: "Department created", title: "College of Business and Accountancy (CBA)", at: "Oct 22, 2026 · 4:09 PM" },
  { action: "Department created", title: "College of Arts and Sciences (CAS)", at: "Oct 22, 2026 · 4:02 PM" },
]

function Dashboard() {
  const sectionHeader = "border-b px-5 py-3.5"
  return (
    <div data-layout="dashboard" className="w-full min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Good morning,</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--ink)]">Welcome back, Ana!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s an overview of your CECT Agent system.</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium">Friday, October 23, 2026</p>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">9:41 AM</p>
        </div>
      </header>

      <section aria-label="System overview" className="mt-5">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map(({ label, value, note, icon: Icon }) => (
            <li key={label} className="min-w-0">
              <div className="flex h-full flex-col rounded-lg border bg-background px-4 py-3.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">{label}</span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</span>
                <span className="mt-2 truncate text-xs text-muted-foreground">{note}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="readiness-heading" className="mt-5 overflow-hidden rounded-lg border bg-background">
        <div className={sectionHeader}>
          <h2 id="readiness-heading" className="font-semibold">System readiness</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Key content and configuration CECT Agent depends on.</p>
        </div>
        <ul className="divide-y">
          {READINESS.map(({ label, status, detail, icon: Icon }) => (
            <li key={label} className="flex items-center gap-3 px-5 py-3">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{detail}</span>
              </span>
              <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", status === "ready" ? "text-[var(--success)]" : "text-[var(--attention)]")}>
                {status === "ready" ? <CircleCheck className="size-3.5" aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
                {status === "ready" ? "Ready" : "Review"}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="updates-heading" className="mt-5 overflow-hidden rounded-lg border bg-background">
        <div className={sectionHeader}>
          <h2 id="updates-heading" className="font-semibold">Recent updates</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Latest changes across CECT Agent.</p>
        </div>
        <ul className="divide-y">
          {UPDATES.map((u) => (
            <li key={u.title} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{u.action}</span>
                <span className="block truncate text-sm font-medium">{u.title}</span>
              </span>
              <span className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
                <span className="sm:flex sm:w-24 sm:justify-start" />
                <time className="text-xs text-muted-foreground tabular-nums sm:w-40 sm:text-right">{u.at}</time>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ---------- Knowledge Library and the collection (their page markup, demo records) ----------

const COLLECTIONS: CollectionSummary[] = [
  { id: "c2d9e7f1-4a6b-4c8d-8e1f-2a3b4c5d6e7f", name: "Admissions", description: null, updatedAt: "2026-10-22T08:00:00.000Z", sources: 0, published: 0, drafts: 0, archived: 0 },
  { ...COLLECTION, updatedAt: "2026-10-22T08:05:00.000Z", sources: 0, published: 0, drafts: 0, archived: 0 },
]

function LibraryRoot() {
  return (
    <div data-layout="wide" className="w-full min-w-0">
      <PageHeader title="Knowledge Library" description="Organize university knowledge into collections. CECT Agent uses Published knowledge from every collection.">
        <CreateCollectionButton />
      </PageHeader>
      <div className="relative mt-5 w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" aria-label="Search collections" placeholder="Search collections" className="h-9 pl-8" readOnly />
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Collections">
        {COLLECTIONS.map((collection) => (
          <li key={collection.id} className="flex">
            <CollectionCard collection={collection} timezone={TIMEZONE} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        {items.map((item, i) => (
          <li key={item} className={cn("flex min-w-0 items-center gap-1.5", i === items.length - 1 ? "font-medium text-foreground" : "shrink-0")}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="truncate">{item}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function CollectionPage() {
  return (
    <div data-layout="wide" className="w-full min-w-0">
      <Breadcrumb items={["Knowledge Library", COLLECTION.name]} />
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{COLLECTION.name}</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{COLLECTION.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" data-demo="add-source">
            <Plus aria-hidden="true" />
            Add source
          </Button>
          <CollectionMenu collection={COLLECTION} sourceCount={0} />
        </div>
      </header>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter sources" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
          {LIBRARY_TABS.map(({ value, label }) => (
            <span
              key={value}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                value === "all" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">0</span>
            </span>
          ))}
        </nav>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" aria-label="Search sources in this collection" placeholder="Search sources / entries" className="h-9 pl-8" readOnly />
        </div>
      </div>
      <div className="mt-5 rounded-lg border bg-background p-2">
        <EmptyState icon={Library} title="This collection is empty." description="Choose Add source to upload a document or create a text source. Only Published knowledge is used by CECT Agent." />
      </div>
    </div>
  )
}

// ---------- Dialogs: the real dialogs' markup, opened and closed by the clock ----------

function DemoDialog({ progress, className, showClose = true, children }: { progress: number; className?: string; showClose?: boolean; children: React.ReactNode }) {
  if (progress <= 0) return null
  return (
    <>
      <div className="fixed inset-0 isolate z-50 bg-black/25" style={{ opacity: progress }} />
      <div
        role="dialog"
        className={cn("fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm", className)}
        style={{ opacity: progress, transform: `translate(-50%, -50%) scale(${0.95 + 0.05 * progress})` }}
      >
        {children}
        {showClose && (
          <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" tabIndex={-1}>
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>
    </>
  )
}

const dialogTitle = "font-heading text-base leading-none font-medium"
const dialogDescription = "text-sm text-muted-foreground"
const dialogFooter = "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end"
const optionClass = "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left outline-none transition-colors hover:border-primary/40 hover:bg-accent/40"

function AddSourceDialog({ t }: { t: number }) {
  return (
    <DemoDialog progress={dialogProgress(t, T.chooserOpen, T.uploadOpen - 0.1)} className="sm:max-w-md">
      <div className="flex flex-col gap-2">
        <h2 className={dialogTitle}>Add source</h2>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" data-demo="upload-option" className={optionClass} tabIndex={-1}>
          <FileUp className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Upload PDF</span>
            <span className="block text-sm text-muted-foreground">Upload an official PDF and let CECT Agent extract knowledge for review.</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <span className={optionClass}>
          <PenLine className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Create text source</span>
            <span className="block text-sm text-muted-foreground">Write or paste reliable information manually.</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
      </div>
    </DemoDialog>
  )
}

/** SourceUploader's Upload PDF modal. The collection implies the source type, so that field is hidden. */
function UploadDialog({ t }: { t: number }) {
  const busy = t >= T.uploadClick
  const file = t >= T.drop
  const dragging = t >= T.dragOver && t < T.drop
  return (
    <DemoDialog progress={dialogProgress(t, T.uploadOpen, T.source)} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg" showClose={!busy}>
      <div className="flex flex-col gap-2 border-b px-6 pt-5 pb-4">
        <h2 className={cn(dialogTitle, "text-base font-semibold")}>Upload PDF</h2>
        <p className={dialogDescription}>Upload a text-selectable PDF up to 25 MB. After upload, you can analyze it with AI to create draft knowledge sections for review.</p>
      </div>
      <div className="flex flex-col gap-5 px-6 py-5">
        <Field id="demo-source-title" label="Title" hint="Shown in citations, e.g. “Student Handbook — Page 42”.">
          <Input id="demo-source-title" data-demo="title-input" value={titleAt(t)} readOnly placeholder="e.g. Student Handbook" disabled={busy} />
        </Field>
        <Field id="demo-source-description" label="Description" optional hint="Admin note shown on the source card. Not used to answer students.">
          <textarea id="demo-source-description" rows={3} readOnly placeholder="Briefly describe what this source contains..." disabled={busy} className={cn(textareaClass, "min-h-0 resize-y")} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">File</span>
          <div className="relative">
            <div
              data-demo="dropzone"
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-4 text-sm transition-colors",
                dragging && "border-ring bg-accent",
                file && "pr-14",
                busy && "cursor-not-allowed opacity-60"
              )}
            >
              {file ? (
                <>
                  <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{DEMO_PDF.fileName}</span>
                    <span className="block text-xs text-muted-foreground">{formatFileSize(DEMO_PDF.fileSize)} · click or drop to replace</span>
                  </span>
                </>
              ) : (
                <>
                  <Upload className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-primary">Choose a file</span>
                    <span className="text-muted-foreground"> or drag it here</span>
                    <span className="block text-xs text-muted-foreground">PDF only</span>
                  </span>
                </>
              )}
            </div>
            {file && (
              <span className={cn("absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground", busy && "opacity-50")}>
                <XIcon className="size-4" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
        {busy && <p role="status" className="text-sm text-muted-foreground">Uploading the file…</p>}
        <div className="-mx-6 -mb-5 mt-1 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" disabled={busy} tabIndex={-1}>Cancel</Button>
          <Button type="button" size="lg" data-demo="upload-submit" disabled={busy || !file} tabIndex={-1}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </DemoDialog>
  )
}

function AnalyzeDialog({ t }: { t: number }) {
  const pending = t >= T.analyzeClick
  return (
    <DemoDialog progress={dialogProgress(t, T.analyzeOpen, T.analyzed)} className="sm:max-w-lg" showClose={!pending}>
      <div className="flex flex-col gap-2">
        <h2 className={dialogTitle}>Analyze document with AI</h2>
        <p className={dialogDescription}>CECT Agent will extract and organize this document into reviewable knowledge sections. Nothing will be published automatically.</p>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
        <li>Text is extracted page by page.</li>
        <li>Sections are grouped by topic, and page references are preserved.</li>
        <li>You can edit, delete or publish each section.</li>
        <li>Only Published sections become available to CECT Agent.</li>
      </ul>
      {pending && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Analyzing… large documents can take a minute.
        </p>
      )}
      <div className={dialogFooter}>
        <Button variant="outline" size="lg" disabled={pending} tabIndex={-1}>Cancel</Button>
        <Button size="lg" data-demo="start-analysis" disabled={pending} tabIndex={-1}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {pending ? "Analyzing…" : "Start analysis"}
        </Button>
      </div>
    </DemoDialog>
  )
}

function PublishDialog({ t }: { t: number }) {
  const pending = t >= T.confirmClick
  const n = DRAFTS.length
  return (
    <DemoDialog progress={dialogProgress(t, T.confirmOpen, T.published)} className="sm:max-w-md" showClose={!pending}>
      <div className="flex flex-col gap-2">
        <h2 className={dialogTitle}>Publish {n} draft sections?</h2>
        <p className={dialogDescription}>
          Confirm you have reviewed them against the original PDF. Published sections are used by CECT Agent to answer students. You can move a section back to Draft at any time.
        </p>
      </div>
      <div className={dialogFooter}>
        <Button variant="outline" size="lg" disabled={pending} tabIndex={-1}>Cancel</Button>
        <Button size="lg" data-demo="confirm-publish" disabled={pending} tabIndex={-1}>
          {pending ? "Publishing…" : "I’ve reviewed them — publish"}
        </Button>
      </div>
    </DemoDialog>
  )
}

// ---------- Source details (app/admin/documents/[id]/page.tsx markup) ----------

function SourcePage({ t }: { t: number }) {
  const analyzed = t >= T.analyzed
  const published = t >= T.published
  const analyzing = t >= T.analyzeClick && !analyzed
  const sections = !analyzed ? [] : published ? PUBLISHED : DRAFTS
  const total = sections.length
  const publishedCount = published ? total : 0
  const drafts = total - publishedCount
  const status = analyzed ? { tone: "published", label: "Ready" } : { tone: "draft", label: "Uploaded" }
  const health = !analyzed
    ? { title: "Not analyzed yet", detail: "Analyze this source with AI to create draft knowledge sections for review, or add sections yourself." }
    : drafts > 0
      ? { title: "Needs review", detail: `${drafts} draft sections are waiting for review before publishing.` }
      : { title: "Ready for CECT Agent answers", detail: `${publishedCount} published sections are used by CECT Agent.` }
  const facts: [string, string][] = [
    ["Source type", "PDF · Student Handbook"],
    ["File", `${DEMO_PDF.fileName} · ${formatFileSize(DEMO_PDF.fileSize)}${analyzed ? ` · ${DEMO_PDF.pages} pages` : ""}`],
    ["Uploaded", TODAY],
    ["Last analyzed", analyzed ? TODAY : "Not analyzed yet"],
  ]

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <Breadcrumb items={["Knowledge Library", COLLECTION.name, SOURCE_TITLE]} />

      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--ink)]">{SOURCE_TITLE}</h1>
            <StatusBadge status={status.tone} label={status.label} />
          </div>
          <dl aria-label="Source details" className="mt-4 grid max-w-2xl grid-cols-1 gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground/90">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <SourceActions
          id={SOURCE_ID}
          title={SOURCE_TITLE}
          description={null}
          status={analyzed ? "ready" : "uploaded"}
          isPdf
          isText={false}
          fileUrl="#"
          publishedCount={publishedCount}
          otherSectionCount={total - publishedCount}
          collectionId={COLLECTION.id}
          collections={COLLECTIONS.map(({ id, name }) => ({ id, name }))}
        />
      </header>

      <section aria-labelledby="status-heading" className="mt-8 border-t pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h2 id="status-heading" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Knowledge status</h2>
            <p className="mt-2 font-medium">{health.title}</p>
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{health.detail}</p>
            {total > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Last analyzed {TODAY} · {total} sections · {publishedCount} published · {drafts} {drafts === 1 ? "draft" : "drafts"}
              </p>
            )}
          </div>
          {/* AnalyzeSourceButton */}
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Button size="lg" data-demo="analyze" disabled={analyzing} tabIndex={-1}>
              {analyzing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {analyzing ? "Analyzing…" : analyzed ? "Re-analyze with AI" : "Analyze with AI"}
            </Button>
            {analyzed && (
              <p role="status" className="max-w-sm text-sm text-muted-foreground sm:text-right" style={{ opacity: seg(t, T.analyzed, T.analyzed + 0.3) }}>
                Analyzed {DEMO_PDF.pages} pages: {DRAFTS.length} new Draft sections.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="original-heading" className="mt-10">
        <h2 id="original-heading" className="text-lg font-semibold">Original PDF</h2>
        <p className="mt-1 text-sm text-muted-foreground">The source of truth. Check each section against it before publishing.</p>
        <PdfPreview />
      </section>

      <SourceSections
        documentId={SOURCE_ID}
        sections={sections}
        overview={analyzed ? OVERVIEW : null}
        format="pdf"
        canAdd
        emptyMessage="No knowledge sections yet. Choose Analyze with AI to extract Draft sections from this PDF, or add a section yourself. Nothing is published automatically."
      />
    </div>
  )
}

/** Stands in for the signed-URL PDF iframe: page 1 of the demo PDF, as extracted. */
function PdfPreview() {
  const page1 = DEMO_SECTIONS.filter((s) => s.pages.length === 1 && s.pages[0] === 1).map((s) => s.content).join("\n")
  return (
    <div className="mt-4 flex h-[min(80vh,820px)] w-full justify-center overflow-hidden rounded-lg border bg-muted px-6 pt-6">
      <div className="w-full max-w-[640px] bg-white px-12 py-10 text-[13px] leading-relaxed whitespace-pre-line text-neutral-900 shadow-sm">{page1}</div>
    </div>
  )
}
