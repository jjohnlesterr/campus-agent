"use client"

import { cn } from "cn"
import Link from "next/link"
import { useActionState } from "react"

import { type ManualEntryState, createManualEntry } from "@/app/admin/knowledge/actions"
import { Field, selectClass, textareaClass } from "@/components/shared/form-field"
import { PendingSubmitButton } from "@/components/shared/pending-submit-button"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Option = { id: string; name: string }

/** collectionId: the collection the entry is created in (null: Uncategorized); cancelHref leads back there. */
export function ManualEntryForm({ categories, offices, defaultCategoryId, collectionId, cancelHref }: {
  categories: Option[]
  offices: Option[]
  defaultCategoryId?: string
  collectionId: string | null
  cancelHref: string
}) {
  const [state, action] = useActionState<ManualEntryState, FormData>(createManualEntry, {})
  const v = state.values ?? {}

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="collectionId" value={collectionId ?? ""} />
      <Field id="entry-title" label="Title">
        <Input id="entry-title" name="title" defaultValue={v.title} placeholder="e.g. How to contact the Registrar" maxLength={200} required />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="entry-category" label="Category">
          <select id="entry-category" name="categoryId" defaultValue={v.categoryId ?? defaultCategoryId} className={selectClass} required>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field id="entry-office" label="Responsible office" optional>
          <select id="entry-office" name="responsibleOfficeId" defaultValue={v.responsibleOfficeId ?? ""} className={selectClass}>
            <option value="">Not specified</option>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      </div>
      <Field id="entry-content" label="Content" hint="Write only verified, official information. Campus Agent answers from this text once the entry is Published.">
        <textarea id="entry-content" name="content" defaultValue={v.content} className={cn(textareaClass, "min-h-64 leading-relaxed")} maxLength={20000} required aria-describedby="entry-content-hint" />
      </Field>
      <Field id="entry-reference" label="Reference note" optional hint="Where this comes from, e.g. “Registrar memo, Aug 2026”. Shown as the source in answers.">
        <Input id="entry-reference" name="referenceNote" defaultValue={v.referenceNote} maxLength={300} aria-describedby="entry-reference-hint" />
      </Field>
      <Field id="entry-visibility" label="Who can see it?">
        <select id="entry-visibility" name="visibility" defaultValue={v.visibility ?? "authenticated"} className={selectClass}>
          <option value="authenticated">Signed-in students only</option>
          <option value="public">Everyone (public assistant and students)</option>
        </select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Status</legend>
        {([
          ["draft", "Draft", "Saved for review. Not used by Campus Agent."],
          ["published", "Published", "Available to Campus Agent and School Guides right away."],
        ] as const).map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm has-checked:border-primary/40 has-checked:bg-accent/40">
            <input type="radio" name="status" value={value} defaultChecked={(v.status ?? "draft") === value} className="mt-0.5 size-4 accent-primary" />
            <span><span className="font-medium">{label}</span><span className="block text-muted-foreground">{hint}</span></span>
          </label>
        ))}
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <PendingSubmitButton size="lg" pendingLabel="Creating…">Create entry</PendingSubmitButton>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>Cancel</Link>
      </div>
    </form>
  )
}
