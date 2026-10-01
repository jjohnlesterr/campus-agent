"use client"

import { useActionState, useState } from "react"

import { saveProfile } from "@/app/app/(shell)/profile/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Profile } from "@/lib/auth"

type Option = { id: string; name: string }
type ProgramOption = Option & { department_id: string }

const YEAR_LEVELS = ["1st year", "2nd year", "3rd year", "4th year", "5th year", "6th year"]

// Native select styled to match the shadcn Input.
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"

export function ProfileForm({
  profile,
  departments,
  programs,
  submitLabel,
}: {
  profile: Profile
  departments: Option[]
  programs: ProgramOption[]
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(saveProfile, undefined)
  const [departmentId, setDepartmentId] = useState(profile.department_id ?? "")
  const departmentPrograms = programs.filter((p) => p.department_id === departmentId)
  const errors = state?.fieldErrors ?? {}

  if (departments.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Departments haven&apos;t been set up yet. Please check back once your school&apos;s
        administrator has added them.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="full_name" label="Full name" error={errors.full_name}>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          defaultValue={profile.full_name ?? ""}
          required
          aria-invalid={Boolean(errors.full_name)}
          aria-describedby={errors.full_name ? "full_name-error" : undefined}
        />
      </Field>

      <Field id="student_id" label="Student ID" error={errors.student_id}>
        <Input
          id="student_id"
          name="student_id"
          defaultValue={profile.student_id ?? ""}
          required
          aria-invalid={Boolean(errors.student_id)}
          aria-describedby={errors.student_id ? "student_id-error" : undefined}
        />
      </Field>

      <Field id="email" label="School email" hint="This is the email you signed in with.">
        <Input id="email" value={profile.email ?? ""} readOnly disabled aria-describedby="email-hint" />
      </Field>

      <Field id="department_id" label="Department" error={errors.department_id}>
        <select
          id="department_id"
          name="department_id"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          required
          className={selectClass}
          aria-invalid={Boolean(errors.department_id)}
          aria-describedby={errors.department_id ? "department_id-error" : undefined}
        >
          <option value="" disabled>
            Select your department
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="program_id" label="Program" error={errors.program_id}>
        {/* Colleges with no programs listed submit an empty program. */}
        {departmentId && departmentPrograms.length === 0 && <input type="hidden" name="program_id" value="" />}
        <select
          // Remount when the department changes so the previous program is cleared.
          key={departmentId}
          id="program_id"
          name="program_id"
          defaultValue={departmentId === profile.department_id ? (profile.program_id ?? "") : ""}
          required={departmentPrograms.length > 0}
          disabled={!departmentId || departmentPrograms.length === 0}
          className={selectClass}
          aria-invalid={Boolean(errors.program_id)}
          aria-describedby={errors.program_id ? "program_id-error" : undefined}
        >
          <option value="" disabled={departmentPrograms.length > 0}>
            {!departmentId
              ? "Select a department first"
              : departmentPrograms.length === 0
                ? "No programs listed for this college"
                : "Select your program"}
          </option>
          {departmentPrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="year_level" label="Year level" error={errors.year_level}>
        <select
          id="year_level"
          name="year_level"
          defaultValue={profile.year_level?.toString() ?? ""}
          required
          className={selectClass}
          aria-invalid={Boolean(errors.year_level)}
          aria-describedby={errors.year_level ? "year_level-error" : undefined}
        >
          <option value="" disabled>
            Select your year level
          </option>
          {YEAR_LEVELS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
