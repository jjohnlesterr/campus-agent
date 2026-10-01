"use client"

import Link from "next/link"
import { useActionState } from "react"

import { saveAnnouncement } from "@/app/admin/announcements/actions"
import { Field, fieldAria, selectClass, textareaClass } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type AnnouncementFormValues = {
  id?: string
  title: string
  content: string
  date: string
  department_id: string
  status: "draft" | "published" | "archived"
}

export function AnnouncementForm({
  values,
  departments,
}: {
  values: AnnouncementFormValues
  departments: { id: string; code: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(saveAnnouncement, undefined)
  const e = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Field id="title" label="Title" error={e.title}>
        <Input id="title" name="title" defaultValue={values.title} required {...fieldAria("title", e.title)} />
      </Field>

      <Field id="content" label="Content" error={e.content}>
        <textarea
          id="content"
          name="content"
          defaultValue={values.content}
          required
          className={`${textareaClass} min-h-40`}
          {...fieldAria("content", e.content)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="date" label="Date" hint="Students see it from this date." error={e.date}>
          <Input id="date" name="date" type="date" defaultValue={values.date} required {...fieldAria("date", e.date, true)} />
        </Field>
        <Field id="status" label="Status" error={e.status}>
          <select id="status" name="status" defaultValue={values.status} className={selectClass} {...fieldAria("status", e.status)}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>

      <Field id="department_id" label="Department" hint="Leave as University-wide if it is for all students." error={e.department_id}>
        <select
          id="department_id"
          name="department_id"
          defaultValue={values.department_id}
          className={selectClass}
          {...fieldAria("department_id", e.department_id, true)}
        >
          <option value="">University-wide</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : values.id ? "Save changes" : "Create announcement"}
        </Button>
        <Link href="/admin/announcements" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
