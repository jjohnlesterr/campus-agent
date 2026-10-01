"use client"

import Link from "next/link"
import { useActionState } from "react"

import { saveEvent } from "@/app/admin/events/actions"
import { Field, fieldAria, selectClass, textareaClass } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type EventFormValues = {
  id?: string
  title: string
  date: string
  time: string
  venue: string
  department_id: string
  description: string
  status: "draft" | "published" | "cancelled"
}

export function EventForm({
  values,
  departments,
}: {
  values: EventFormValues
  departments: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(saveEvent, undefined)
  const e = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Field id="title" label="Title" error={e.title}>
        <Input id="title" name="title" defaultValue={values.title} required {...fieldAria("title", e.title)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="date" label="Date" error={e.date}>
          <Input id="date" name="date" type="date" defaultValue={values.date} required {...fieldAria("date", e.date)} />
        </Field>
        <Field id="time" label="Time" optional hint="Leave empty for an all-day event." error={e.time}>
          <Input id="time" name="time" type="time" defaultValue={values.time} {...fieldAria("time", e.time, true)} />
        </Field>
      </div>

      <Field id="venue" label="Venue" optional error={e.venue}>
        <Input id="venue" name="venue" defaultValue={values.venue} placeholder="e.g. University Gymnasium" {...fieldAria("venue", e.venue)} />
      </Field>

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
              {d.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="description" label="Description" optional error={e.description}>
        <textarea
          id="description"
          name="description"
          defaultValue={values.description}
          className={textareaClass}
          {...fieldAria("description", e.description)}
        />
      </Field>

      <Field id="status" label="Status" hint="Students only see published and cancelled events." error={e.status}>
        <select id="status" name="status" defaultValue={values.status} className={selectClass} {...fieldAria("status", e.status, true)}>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : values.id ? "Save changes" : "Create event"}
        </Button>
        <Link href="/admin/events" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
