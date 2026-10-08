"use client"

import Link from "next/link"
import { useActionState } from "react"

import { saveAnnouncement } from "@/app/admin/announcements/actions"
import { Field, fieldAria, textareaClass } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type AnnouncementFormValues = {
  id?: string
  title: string
  content: string
  date: string
  sourceLabel: string
  sourceUrl: string
}

/** University-wide announcement. "Save draft" keeps it admin-only; "Publish" shows it to everyone. */
export function AnnouncementForm({ values }: { values: AnnouncementFormValues }) {
  const [state, formAction, pending] = useActionState(saveAnnouncement, undefined)
  const e = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Field id="title" label="Title" error={e.title}>
        <Input id="title" name="title" defaultValue={values.title} maxLength={200} required placeholder="e.g. Second semester enrollment schedule" {...fieldAria("title", e.title)} />
      </Field>

      <Field id="content" label="Content" error={e.content}>
        <textarea
          id="content"
          name="content"
          defaultValue={values.content}
          maxLength={8000}
          required
          className={`${textareaClass} min-h-40`}
          {...fieldAria("content", e.content)}
        />
      </Field>

      <Field id="date" label="Published date" hint="Shown on the announcement; newest appear first." error={e.date}>
        <Input id="date" name="date" type="date" defaultValue={values.date} required className="sm:max-w-56" {...fieldAria("date", e.date, true)} />
      </Field>

      <Field id="source_label" label="Source label" optional hint="Where it was announced, e.g. the university’s official Facebook page." error={e.source_label}>
        <Input id="source_label" name="source_label" defaultValue={values.sourceLabel} maxLength={200} {...fieldAria("source_label", e.source_label, true)} />
      </Field>

      <Field id="source_url" label="Source URL" optional hint="Paste the link to the original post or notice. Users see “View original source”." error={e.source_url}>
        <Input id="source_url" name="source_url" type="url" inputMode="url" defaultValue={values.sourceUrl} placeholder="https://" maxLength={2000} {...fieldAria("source_url", e.source_url, true)} />
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <Button type="submit" name="intent" value="published" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Publish"}
        </Button>
        <Button type="submit" name="intent" value="draft" variant="outline" size="lg" disabled={pending}>
          Save draft
        </Button>
        <Link href="/admin/announcements" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
