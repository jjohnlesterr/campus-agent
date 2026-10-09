"use client"

import Link from "next/link"
import { useActionState } from "react"

import { saveOffice } from "@/app/admin/offices/actions"
import { Field, fieldAria } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type OfficeFormValues = {
  id?: string
  name: string
  head_name: string
  office_hours: string
  location: string
}

export function OfficeForm({
  values,
  locationNames,
}: {
  values: OfficeFormValues
  locationNames: string[]
}) {
  const [state, formAction, pending] = useActionState(saveOffice, undefined)
  const e = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Field id="name" label="Office name" error={e.name}>
        <Input id="name" name="name" defaultValue={values.name} required placeholder="e.g. Office of the Registrar" {...fieldAria("name", e.name)} />
      </Field>

      <Field id="head_name" label="Office head" optional error={e.head_name}>
        <Input id="head_name" name="head_name" defaultValue={values.head_name} {...fieldAria("head_name", e.head_name)} />
      </Field>

      <Field id="office_hours" label="Office hours" optional error={e.office_hours}>
        <Input
          id="office_hours"
          name="office_hours"
          defaultValue={values.office_hours}
          placeholder="e.g. Mon–Fri, 8:00 AM – 5:00 PM"
          {...fieldAria("office_hours", e.office_hours)}
        />
      </Field>

      <Field
        id="location"
        label="Location"
        optional
        hint="Building and floor. Existing campus locations are suggested as you type."
        error={e.location}
      >
        <Input
          id="location"
          name="location"
          list="campus-locations"
          defaultValue={values.location}
          placeholder="e.g. Administration Building, Ground Floor"
          {...fieldAria("location", e.location, true)}
        />
        <datalist id="campus-locations">
          {locationNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : values.id ? "Save changes" : "Create office"}
        </Button>
        <Link href="/admin/offices" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
