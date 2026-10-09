"use client"

import { cn } from "cn"
import { Archive, ArchiveRestore, ChevronDown, Plus, Sparkles, Trash2, Undo2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteGuide, saveGuide, setGuideArchived, unpublishGuide } from "@/app/admin/knowledge/actions"
import { Field, selectClass, textareaClass } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { GuideStep } from "@/lib/knowledge/topics"

export type GuideEditorValues = {
  id: string
  updatedAt: string
  title: string
  categoryId: string
  description: string
  content: string
  requirements: string[]
  steps: GuideStep[]
  pages: number[]
  referenceNote: string
  visibility: "public" | "authenticated"
  responsibleOfficeId: string | null
  status: "draft" | "published" | "archived"
}

type Option = { id: string; name: string }
type Busy = "draft" | "published" | "unpublish" | "archive" | "restore" | "delete" | null

/**
 * Review / edit one knowledge section. `fromSource` sections were extracted by AI
 * from a file: they must be confirmed against the original before publishing.
 * `paged`: the source is a PDF, so the section cites pages (text sources have none).
 */
export function GuideEditor({ values, fromSource, paged, backHref, categories, offices }: {
  values: GuideEditorValues
  fromSource: boolean
  paged: boolean
  backHref: string
  categories: Option[]
  offices: Option[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(values.title)
  const [categoryId, setCategoryId] = useState(values.categoryId)
  const [description, setDescription] = useState(values.description)
  const [content, setContent] = useState(values.content)
  const [requirements, setRequirements] = useState(values.requirements.join("\n"))
  const [steps, setSteps] = useState(values.steps)
  const [pages, setPages] = useState(values.pages.join(", "))
  const [referenceNote, setReferenceNote] = useState(values.referenceNote)
  const [visibility, setVisibility] = useState(values.visibility)
  const [office, setOffice] = useState(values.responsibleOfficeId ?? "")
  // A Published section was already reviewed; any edit asks for confirmation again.
  const [reviewed, setReviewed] = useState(values.status === "published")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Busy>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const published = values.status === "published"
  const archived = values.status === "archived"
  const needsReview = fromSource && !reviewed
  const edited = <T,>(set: (value: T) => void) => (value: T) => { set(value); setReviewed(false) }
  const updateStep = (index: number, field: keyof GuideStep, value: string) => {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, [field]: value } : step)))
    setReviewed(false)
  }

  function act(kind: Exclude<Busy, null>, action: () => Promise<{ ok: true } | { ok: false; error: string }>, after: "back" | "refresh") {
    setBusy(kind)
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setError(result.error)
        if (after === "back") router.push(backHref)
        router.refresh()
      } catch {
        setError("The request was interrupted. Reload the section to check its latest state.")
      }
    })
  }

  function save(intent: "draft" | "published") {
    act(intent, () => saveGuide({
      id: values.id, updatedAt: values.updatedAt, title, categoryId, description, content,
      requirements: requirements.split("\n").map((s) => s.trim()).filter(Boolean), steps,
      pages: fromSource && paged ? pages.split(",").map((s) => s.trim()).filter(Boolean).map(Number) : [],
      referenceNote: fromSource ? "" : referenceNote, visibility,
      responsibleOfficeId: office || null, intent, reviewed: fromSource ? reviewed : true,
    }), "back")
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(published ? "published" : "draft") }} className="flex flex-col gap-5">
      {fromSource && !published && !archived && (
        <p className="flex items-start gap-2 rounded-md border border-[var(--attention-border)] bg-[var(--attention-surface)] px-3 py-2.5 text-sm text-[var(--attention)]">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          AI-generated draft — review before publishing.
        </p>
      )}
      {archived && (
        <p className="rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">This section is archived. Campus Agent and students don’t use it. Restore it as a Draft to edit and publish it again.</p>
      )}

      <fieldset disabled={pending || archived} className="flex min-w-0 flex-col gap-5">
        <Field id="section-title" label="Title">
          <Input id="section-title" value={title} onChange={(e) => edited(setTitle)(e.target.value)} maxLength={200} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="section-category" label="Category">
            <select id="section-category" value={categoryId} onChange={(e) => edited(setCategoryId)(e.target.value)} className={selectClass}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {fromSource ? (paged && (
            <Field id="section-pages" label="Page reference" hint="Comma-separated pages, e.g. 4, 5">
              <Input id="section-pages" value={pages} onChange={(e) => edited(setPages)(e.target.value)} inputMode="numeric" required aria-describedby="section-pages-hint" />
            </Field>
          )) : (
            <Field id="section-reference" label="Reference note" optional hint="Shown as the source in answers, e.g. “Registrar memo, Aug 2026”.">
              <Input id="section-reference" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} maxLength={300} aria-describedby="section-reference-hint" />
            </Field>
          )}
        </div>
        <Field id="section-summary" label={fromSource ? "AI-generated summary" : "Summary"} optional hint="Short description shown on School Guides. Leave empty to use the start of the content.">
          <textarea id="section-summary" value={description} onChange={(e) => edited(setDescription)(e.target.value)} className={cn(textareaClass, "min-h-20")} maxLength={1000} aria-describedby="section-summary-hint" />
        </Field>
        <Field id="section-content" label={fromSource ? "Extracted content" : "Content"} hint="Campus Agent answers only from this text once the section is Published.">
          <textarea id="section-content" value={content} onChange={(e) => edited(setContent)(e.target.value)} className={cn(textareaClass, "min-h-72 font-[inherit] leading-relaxed")} maxLength={20000} required aria-describedby="section-content-hint" />
        </Field>
        <Field id="section-office" label="Responsible office" optional hint={fromSource ? "Must be named in the extracted content." : undefined}>
          <select id="section-office" value={office} onChange={(e) => edited(setOffice)(e.target.value)} className={selectClass}>
            <option value="">Not specified</option>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        {!fromSource && (
          <Field id="section-visibility" label="Who can see it?">
            <select id="section-visibility" value={visibility} onChange={(e) => edited(setVisibility)(e.target.value === "public" ? "public" : "authenticated")} className={selectClass}>
              <option value="authenticated">Signed-in students only</option>
              <option value="public">Everyone (public assistant and students)</option>
            </select>
          </Field>
        )}

        <details className="group rounded-lg border" open={steps.length > 0 || values.requirements.length > 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            School Guides structure (optional)
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-5 border-t px-4 py-4">
            <p className="text-sm text-muted-foreground">Requirements and steps shown on the student School Guides page. Use only what the content states.</p>
            <Field id="section-requirements" label="Requirements" optional hint="One per line.">
              <textarea id="section-requirements" value={requirements} onChange={(e) => edited(setRequirements)(e.target.value)} className={textareaClass} />
            </Field>
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Steps</span>
                <Button type="button" variant="outline" size="sm" onClick={() => { setSteps([...steps, { title: "", description: "" }]); setReviewed(false) }}>
                  <Plus aria-hidden="true" />Add step
                </Button>
              </div>
              <ol className="mt-3 flex flex-col gap-4">
                {steps.map((step, index) => (
                  <li key={index} className="flex flex-col gap-2 border-t pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Step {index + 1}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove step ${index + 1}`} onClick={() => { setSteps(steps.filter((_, i) => i !== index)); setReviewed(false) }}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <Field id={`step-title-${index}`} label="Step title">
                      <Input id={`step-title-${index}`} value={step.title} onChange={(e) => updateStep(index, "title", e.target.value)} maxLength={200} required />
                    </Field>
                    <Field id={`step-description-${index}`} label="Step details" optional>
                      <textarea id={`step-description-${index}`} value={step.description} onChange={(e) => updateStep(index, "description", e.target.value)} className={cn(textareaClass, "min-h-16")} maxLength={4000} />
                    </Field>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </details>

        {fromSource && (
          <label id="publish" className="flex scroll-mt-24 items-start gap-3 rounded-md border bg-muted/30 px-3 py-3 text-sm leading-relaxed">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />
            I compared this section with the original source and verified its content and page reference.
          </label>
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-2 border-t bg-background px-5 py-3 sm:-mx-6 sm:px-6">
        {archived ? (
          <Button type="button" size="lg" disabled={pending} onClick={() => act("restore", () => setGuideArchived(values.id, false), "refresh")}>
            <ArchiveRestore aria-hidden="true" />{busy === "restore" && pending ? "Restoring…" : "Restore as Draft"}
          </Button>
        ) : published ? (
          <>
            <Button type="submit" size="lg" disabled={pending || needsReview}>{busy === "published" && pending ? "Saving…" : "Save changes"}</Button>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => act("unpublish", () => unpublishGuide(values.id), "refresh")}>
              <Undo2 aria-hidden="true" />{busy === "unpublish" && pending ? "Moving…" : "Unpublish"}
            </Button>
            <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => act("archive", () => setGuideArchived(values.id, true), "refresh")}>
              <Archive aria-hidden="true" />Archive
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="lg" disabled={pending || needsReview} onClick={() => save("published")}>{busy === "published" && pending ? "Publishing…" : "Publish"}</Button>
            <Button type="submit" variant="outline" size="lg" disabled={pending}>{busy === "draft" && pending ? "Saving…" : "Save as Draft"}</Button>
          </>
        )}
        <Link href={backHref} className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</Link>
        {!published && (
          <Button type="button" variant="ghost" size="lg" className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" />Delete
          </Button>
        )}
      </div>
      {fromSource && needsReview && !archived && (
        <p className="-mt-3 text-xs text-muted-foreground">Confirm the review checkbox to {published ? "save changes to this Published section" : "publish"}.</p>
      )}

      <Dialog open={confirmDelete} onOpenChange={(next) => { if (!pending) setConfirmDelete(next) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete this section?</DialogTitle>
            <DialogDescription>“{values.title}” will be permanently deleted.{fromSource ? " The original source file is not affected." : ""} This cannot be undone.</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button type="button" variant="destructive" size="lg" disabled={pending} onClick={() => act("delete", () => deleteGuide(values.id), "back")}>
              {busy === "delete" && pending ? "Deleting…" : "Delete section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
