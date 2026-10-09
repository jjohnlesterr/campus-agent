"use client"

import { CircleCheck } from "lucide-react"
import { useActionState, useState, useTransition } from "react"

import { updateProfile } from "@/app/app/(shell)/profile/actions"
import { Field, fieldAria, selectClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { programsForDepartment } from "@/lib/programs"
import { USER_TYPES } from "@/lib/user-types"

type Option = { id: string; code: string; name: string }
type ProgramOption = { id: string; code: string | null; name: string; department_id: string }

export type ProfileValues = {
  full_name: string
  user_type: string
  intended_department_id: string
  intended_program_id: string
}

export function ProfileForm({ values, departments, programs }: { values: ProfileValues; departments: Option[]; programs: ProgramOption[] }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined)
  const [, startTransition] = useTransition()
  const [departmentId, setDepartmentId] = useState(values.intended_department_id)
  const [programId, setProgramId] = useState(values.intended_program_id)
  const departmentPrograms = programsForDepartment(programs, departmentId)
  const e = state?.fieldErrors ?? {}

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(() => formAction(data))
      }}
      className="flex max-w-xl flex-col gap-5"
    >
      <Field id="full_name" label="Full name" error={e.full_name}>
        <Input id="full_name" name="full_name" defaultValue={values.full_name} autoComplete="name" required {...fieldAria("full_name", e.full_name)} />
      </Field>

      <Field id="user_type" label="I am a…" error={e.user_type}>
        <select id="user_type" name="user_type" defaultValue={values.user_type} required className={selectClass} {...fieldAria("user_type", e.user_type)}>
          <option value="" disabled>
            Choose…
          </option>
          {USER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="intended_department_id" label="Intended college" optional error={e.intended_department_id}>
          <select
            id="intended_department_id"
            name="intended_department_id"
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value)
              setProgramId("")
            }}
            className={selectClass}
            {...fieldAria("intended_department_id", e.intended_department_id)}
          >
            <option value="">Not sure yet</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="intended_program_id" label="Intended program" optional error={e.intended_program_id}>
          <select
            id="intended_program_id"
            name="intended_program_id"
            value={programId}
            onChange={(event) => setProgramId(event.target.value)}
            disabled={departmentPrograms.length === 0}
            className={selectClass}
            {...fieldAria("intended_program_id", e.intended_program_id)}
          >
            <option value="">Not sure yet</option>
            {departmentPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {!p.code || p.code === p.name ? p.name : `${p.name} (${p.code})`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.saved && (
        <p role="status" className="flex items-center gap-2 text-sm text-[var(--success)]">
          <CircleCheck className="size-4" aria-hidden="true" />
          Profile saved.
        </p>
      )}

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  )
}
