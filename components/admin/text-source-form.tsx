"use client"

import { cn } from "cn"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { useActionState } from "react"

import { type TextSourceState, createTextSource } from "@/app/admin/documents/actions"
import { Field, textareaClass } from "@/components/shared/form-field"
import { PendingSubmitButton } from "@/components/shared/pending-submit-button"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MAX_TEXT_SOURCE_CHARS } from "@/lib/sources"

/**
 * Create text source: verified text written or pasted by an admin. Saved as a Draft
 * source in `collectionId` (null: Uncategorized); Organize with AI also turns it into
 * Draft sections for review. Nothing is published from here.
 */
export function TextSourceForm({ collectionId, cancelHref }: { collectionId: string | null; cancelHref: string }) {
  const [state, action] = useActionState<TextSourceState, FormData>(createTextSource, {})
  const v = state.values ?? {}

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="collectionId" value={collectionId ?? ""} />
      <Field id="text-title" label="Title" hint="Shown as the source in answers.">
        <Input id="text-title" name="title" defaultValue={v.title} placeholder="e.g. Late enrollment clarification" maxLength={200} required aria-describedby="text-title-hint" />
      </Field>
      <Field id="text-description" label="Description" optional hint="Admin note shown on the source card. Not used to answer students.">
        <textarea
          id="text-description"
          name="description"
          defaultValue={v.description}
          rows={3}
          maxLength={1000}
          placeholder="Briefly describe what this source contains..."
          className={cn(textareaClass, "min-h-0 resize-y")}
          aria-describedby="text-description-hint"
        />
      </Field>
      <Field id="text-content" label="Content" hint="Paste or write only verified, official information. It is kept exactly as entered.">
        <textarea
          id="text-content"
          name="content"
          defaultValue={v.content}
          className={cn(textareaClass, "min-h-96 leading-relaxed")}
          maxLength={MAX_TEXT_SOURCE_CHARS}
          required
          aria-describedby="text-content-hint"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="text-reference" label="Source / reference" optional hint="e.g. “Registrar memo, Aug 2026”. Added to citations.">
          <Input id="text-reference" name="referenceLabel" defaultValue={v.referenceLabel} maxLength={300} aria-describedby="text-reference-hint" />
        </Field>
        <Field id="text-url" label="Source URL" optional hint="Link to the official original, if there is one.">
          <Input id="text-url" name="sourceUrl" type="url" inputMode="url" defaultValue={v.sourceUrl} placeholder="https://" maxLength={2000} aria-describedby="text-url-hint" />
        </Field>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-col gap-3 border-t pt-5">
        <div className="flex flex-wrap gap-2">
          <PendingSubmitButton name="intent" value="draft" size="lg" pendingLabel="Saving…">Save as Draft</PendingSubmitButton>
          <PendingSubmitButton name="intent" value="organize" variant="outline" size="lg" pendingLabel="Organizing…">
            <Sparkles aria-hidden="true" />
            Organize with AI
          </PendingSubmitButton>
          <Link href={cancelHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>Cancel</Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Organize with AI splits the text into Draft knowledge sections for review. Your original text is kept. Nothing is published automatically.
        </p>
      </div>
    </form>
  )
}
