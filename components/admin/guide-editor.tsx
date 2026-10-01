"use client"

import { cn } from "cn"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Plus, Trash2 } from "lucide-react"
import { saveGuide, unpublishGuide } from "@/app/admin/knowledge/actions"
import { Field, selectClass, textareaClass } from "@/components/shared/form-field"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import type { GuideStep } from "@/lib/knowledge/topics"

export type GuideEditorValues = {
  id: string; updatedAt: string; title: string; description: string; requirements: string[]; steps: GuideStep[];
  pages: number[]; responsibleOfficeId: string | null; status: string
}
export function GuideEditor({ values, offices }: { values: GuideEditorValues; offices: { id: string; name: string }[] }) {
  const router = useRouter()
  const [title, setTitle] = useState(values.title)
  const [description, setDescription] = useState(values.description)
  const [requirements, setRequirements] = useState(values.requirements.join("\n"))
  const [pages, setPages] = useState(values.pages.join(", "))
  const [office, setOffice] = useState(values.responsibleOfficeId ?? "")
  const [steps, setSteps] = useState(values.steps)
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const updateStep = (index: number, field: keyof GuideStep, value: string) => setSteps(current => current.map((step, i) => i === index ? { ...step, [field]: value } : step))
  function save(intent: "draft" | "published") {
    startTransition(async () => {
      setError(null)
      try {
        const result = await saveGuide({ id: values.id, updatedAt: values.updatedAt, title, description,
          requirements: requirements.split("\n").map(s => s.trim()).filter(Boolean), steps,
          pages: pages.split(",").map(s => Number(s.trim())), responsibleOfficeId: office || null, intent, reviewed })
        if (!result.ok) setError(result.error)
        else { router.push("/admin/knowledge"); router.refresh() }
      } catch { setError("The save was interrupted. Reopen the saved guide before publishing to check its latest state.") }
    })
  }
  return (
    <form onSubmit={e => { e.preventDefault(); save("draft") }} className="flex flex-col gap-6">
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        <Field id="guide-title" label="Title"><Input id="guide-title" value={title} onChange={e => { setTitle(e.target.value); setReviewed(false) }} maxLength={200} required /></Field>
        <Field id="guide-description" label="Short description"><textarea id="guide-description" value={description} onChange={e => { setDescription(e.target.value); setReviewed(false) }} className={`${textareaClass} min-h-32`} maxLength={6000} required /></Field>
        <Field id="guide-requirements" label="Requirements" optional hint="One per line. Leave empty when the source does not provide requirements."><textarea id="guide-requirements" value={requirements} onChange={e => { setRequirements(e.target.value); setReviewed(false) }} className={textareaClass} /></Field>
        <section aria-labelledby="guide-steps-heading">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="guide-steps-heading" className="font-semibold">Steps</h2><Button type="button" variant="outline" onClick={() => { setSteps([...steps, { title: "", description: "" }]); setReviewed(false) }}><Plus aria-hidden="true" />Add step</Button></div>
          <p className="mt-2 text-sm text-muted-foreground">Use only procedures supported by the excerpts. Information guides can have no steps.</p>
          <ol className="mt-4 flex flex-col gap-5">
            {steps.map((step, index) => <li key={index} className="border-t pt-4">
              <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm font-medium">Step {index + 1}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remove step ${index + 1}`} onClick={() => { setSteps(steps.filter((_, i) => i !== index)); setReviewed(false) }}><Trash2 className="size-4" aria-hidden="true" /></Button></div>
              <Field id={`step-title-${index}`} label="Step title"><Input id={`step-title-${index}`} value={step.title} onChange={e => { updateStep(index, "title", e.target.value); setReviewed(false) }} maxLength={200} required /></Field>
              <div className="mt-3"><Field id={`step-description-${index}`} label="Step details" optional><textarea id={`step-description-${index}`} value={step.description} onChange={e => { updateStep(index, "description", e.target.value); setReviewed(false) }} className={textareaClass} maxLength={4000} /></Field></div>
            </li>)}
          </ol>
        </section>
        <Field id="guide-pages" label="Source pages" hint="Comma-separated page numbers from the linked excerpts."><Input id="guide-pages" value={pages} onChange={e => { setPages(e.target.value); setReviewed(false) }} required /></Field>
        <Field id="guide-office" label="Responsible office" optional hint="Only offices explicitly named in the excerpts can be selected."><select id="guide-office" value={office} onChange={e => { setOffice(e.target.value); setReviewed(false) }} className={selectClass}><option value="">Not specified</option>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <label className="flex items-start gap-3 border-t pt-5 text-sm leading-relaxed"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />I reviewed the linked source excerpts and verified the guide content and page references.</label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error} <button type="button" onClick={() => window.location.reload()} className="font-medium underline">Reload saved guide</button></p>}
      <div className="flex flex-wrap gap-2 border-t pt-5">
        <Button type="submit" variant="outline" size="lg" disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button>
        <Button type="button" size="lg" disabled={pending || !reviewed} onClick={() => save("published")}>Publish guide</Button>
        {values.status === "published" && <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => startTransition(async () => {
          try { const result = await unpublishGuide(values.id); if (!result.ok) setError(result.error); else { router.push("/admin/knowledge?status=draft"); router.refresh() } } catch { setError("The guide could not be unpublished. Please reload and try again.") }
        })}>Unpublish</Button>}
        <Link href="/admin/knowledge" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>Back to library</Link>
      </div>
    </form>
  )
}
