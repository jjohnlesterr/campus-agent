"use client"

import { Check, CircleCheck, Copy, Info, KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useState, useTransition } from "react"

import { type EmailStatus, createStudent, resetStudentPassword, updateStudent } from "@/app/admin/users/actions"
import { Field, fieldAria, selectClass } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { programsForDepartment } from "@/lib/programs"

type Option = { id: string; code: string; name: string }
export type ProgramOption = Option & { department_id: string }
type Errors = Record<string, string>

export type StudentValues = {
  id: string
  full_name: string
  student_id: string
  email: string
  department_id: string
  program_id: string
  year_level: string
}

const YEAR_LEVELS = [1, 2, 3, 4, 5, 6]

/** 12 characters from an unambiguous alphabet, from the browser's CSPRNG. */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

/** Submits without React's automatic form reset, so values survive validation errors. */
function useManualSubmit(action: (data: FormData) => void, before?: () => void) {
  const [, startTransition] = useTransition()
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    before?.()
    startTransition(() => action(data))
  }
}

// ---------- Shared fields ----------

function ProfileFields({
  departments,
  programs,
  errors: e,
  values,
}: {
  departments: Option[]
  programs: ProgramOption[]
  errors: Errors
  values?: Partial<StudentValues>
}) {
  const [departmentId, setDepartmentId] = useState(values?.department_id ?? "")
  const [programId, setProgramId] = useState(values?.program_id ?? "")
  const departmentPrograms = programsForDepartment(programs, departmentId)
  const programHint = !departmentId
    ? "Choose a department first."
    : departmentPrograms.length === 0
      ? "No verified programs are listed for this department yet."
      : undefined

  return (
    <>
      <Field id="full_name" label="Full name" error={e.full_name}>
        <Input id="full_name" name="full_name" defaultValue={values?.full_name} autoComplete="off" required {...fieldAria("full_name", e.full_name)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="student_id" label="Student ID" error={e.student_id}>
          <Input id="student_id" name="student_id" defaultValue={values?.student_id} autoComplete="off" required {...fieldAria("student_id", e.student_id)} />
        </Field>
        <Field id="year_level" label="Year level" error={e.year_level}>
          <select id="year_level" name="year_level" required defaultValue={values?.year_level ?? ""} className={selectClass} {...fieldAria("year_level", e.year_level)}>
            <option value="" disabled>
              Choose…
            </option>
            {YEAR_LEVELS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="department_id" label="Department" error={e.department_id}>
          <select
            id="department_id"
            name="department_id"
            required
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value)
              setProgramId("")
            }}
            className={selectClass}
            {...fieldAria("department_id", e.department_id)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} title={d.name}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="program_id" label="Program" optional hint={programHint} error={e.program_id}>
          <select
            id="program_id"
            name="program_id"
            value={programId}
            onChange={(event) => setProgramId(event.target.value)}
            disabled={departmentPrograms.length === 0}
            className={selectClass}
            {...fieldAria("program_id", e.program_id, Boolean(programHint))}
          >
            <option value="">No program selected</option>
            {departmentPrograms.map((p) => (
              <option key={p.id} value={p.id} title={p.name}>
                {p.code === p.name ? p.code : `${p.name} (${p.code})`}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  )
}

function TemporaryPasswordField({ error, hint }: { error?: string; hint: string }) {
  const [value, setValue] = useState("")
  return (
    <Field id="password" label="Temporary password" hint={hint} error={error}>
      <div className="flex gap-2">
        <Input
          id="password"
          name="password"
          type="text"
          autoComplete="off"
          spellCheck={false}
          minLength={8}
          maxLength={72}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono"
          {...fieldAria("password", error, true)}
        />
        <Button type="button" variant="outline" onClick={() => setValue(generatePassword())}>
          <KeyRound aria-hidden="true" />
          Generate
        </Button>
      </div>
    </Field>
  )
}

/** Shows a temporary password once, with a copy button. It is never stored. */
function OneTimePassword({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 rounded-md border bg-muted/50 px-2.5 py-1.5 font-mono text-sm break-all">{value}</code>
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

/**
 * Whether the sign-in email went out. The account change itself always succeeded, so a
 * delivery failure is informational, and service details are never shown to the admin.
 */
const EMAIL_UNAVAILABLE: Record<Exclude<EmailStatus, "sent">, string> = {
  not_configured: "Email delivery is unavailable in this demo environment.",
  domain_not_verified: "Email delivery is unavailable in this demo environment.",
  failed: "The sign-in email couldn't be delivered right now.",
}

function EmailStatusNote({ status, created }: { status: EmailStatus; created: boolean }) {
  if (status === "sent") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-md border border-[var(--success-border)] bg-[var(--success-surface)] px-3 py-2 text-sm text-[var(--success)]">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Sign-in instructions were sent to the student&apos;s email.</span>
      </p>
    )
  }
  return (
    <p role="status" className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>
        {created ? "Student account created successfully." : "Temporary password reset successfully."}{" "}
        {EMAIL_UNAVAILABLE[status]} Please copy the temporary password below and share it with the student.
      </span>
    </p>
  )
}

function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

// ---------- Create ----------

export function CreateStudentForm({
  departments,
  programs,
  defaultDepartmentId,
  backHref,
  disabled,
}: {
  departments: Option[]
  programs: ProgramOption[]
  defaultDepartmentId?: string
  backHref: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createStudent, undefined)
  const [dismissed, setDismissed] = useState(false)
  // Remounting the fields is the reset for "Add another student".
  const [formKey, setFormKey] = useState(0)
  const onSubmit = useManualSubmit(formAction, () => setDismissed(false))

  const e = state && !state.created ? (state.fieldErrors ?? {}) : {}
  const created = state?.created

  function addAnother() {
    setFormKey((k) => k + 1)
    setDismissed(true)
  }

  return (
    <>
      <form key={formKey} onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5">
        <ProfileFields departments={departments} programs={programs} errors={e} values={{ department_id: defaultDepartmentId }} />

        <Field id="email" label="School email" hint="The student signs in with this email." error={e.email}>
          <Input id="email" name="email" type="email" autoComplete="off" required {...fieldAria("email", e.email, true)} />
        </Field>

        <TemporaryPasswordField
          error={e.password}
          hint="At least 8 characters. The student must change it on first login. It isn't stored by Campus Agent."
        />

        <FormError message={state && !state.created ? state.error : undefined} />

        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={pending || disabled}>
            {pending ? "Creating account…" : "Create student account"}
          </Button>
          <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
            Cancel
          </Link>
        </div>
      </form>

      <Dialog open={Boolean(created) && !dismissed} onOpenChange={(open) => !open && addAnother()}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b px-6 pt-5 pb-4">
            <DialogTitle className="text-base font-semibold">Student account created</DialogTitle>
            <DialogDescription>
              Sign-in details for {created?.fullName}. The temporary password is shown only once.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <dl className="grid gap-3 px-6 py-5 text-sm">
              <EmailStatusNote status={created.emailStatus} created />
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-0.5 font-medium break-all">{created.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Temporary password</dt>
                <dd className="mt-1">
                  <OneTimePassword value={created.temporaryPassword} />
                </dd>
              </div>
              <p className="text-xs text-muted-foreground">
                On first sign-in the student is asked to choose a new password before using Campus Agent.
              </p>
            </dl>
          )}
          <DialogFooter className="mx-0 mb-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={addAnother}>
              Add another student
            </Button>
            <Button type="button" onClick={() => router.push(backHref)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- Edit ----------

export function EditStudentForm({
  student,
  departments,
  programs,
  disabled,
}: {
  student: StudentValues
  departments: Option[]
  programs: ProgramOption[]
  disabled?: boolean
}) {
  const [state, formAction, pending] = useActionState(updateStudent, undefined)
  const onSubmit = useManualSubmit(formAction)
  const e = state?.fieldErrors ?? {}

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5">
      <input type="hidden" name="id" value={student.id} />
      <ProfileFields departments={departments} programs={programs} errors={e} values={student} />

      <Field id="email" label="School email" hint="The sign-in email can't be changed here.">
        <Input id="email" value={student.email} readOnly disabled aria-describedby="email-hint" />
      </Field>

      <FormError message={state?.error} />

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending || disabled}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Link href="/admin/users" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}

// ---------- Reset temporary password ----------

export function ResetPasswordForm({ studentId, disabled }: { studentId: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(resetStudentPassword.bind(null, studentId), undefined)
  const onSubmit = useManualSubmit(formAction)
  const failed = state && state.temporaryPassword === undefined ? state : undefined
  const e = failed?.fieldErrors ?? {}

  if (state?.temporaryPassword) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <EmailStatusNote status={state.emailStatus} created={false} />
        <p className="text-sm text-muted-foreground">
          New temporary password (shown only once). The student must change it on their next sign-in.
        </p>
        <OneTimePassword value={state.temporaryPassword} />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <TemporaryPasswordField
        error={e.password}
        hint="Replaces the student's current password. They must choose a new one on their next sign-in."
      />
      <FormError message={failed?.error} />
      <div>
        <Button type="submit" variant="outline" disabled={pending || disabled}>
          {pending ? "Resetting…" : "Reset temporary password"}
        </Button>
      </div>
    </form>
  )
}
