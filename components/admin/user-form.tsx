"use client"

import { CircleCheck, Send } from "lucide-react"
import Link from "next/link"
import { useActionState, useRef, useState, useTransition } from "react"

import { inviteUser, updateUser } from "@/app/admin/users/actions"
import { Field, fieldAria } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Errors = Record<string, string>

/** Current account fields only: name and sign-in email. */
export type UserValues = {
  id: string
  full_name: string
  email: string
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

/** Full name (editable), then the email field (`email`). */
function ProfileFields({ errors: e, values, email }: { errors: Errors; values?: Partial<UserValues>; email: React.ReactNode }) {
  return (
    <>
      <Field id="full_name" label="Full name" error={e.full_name}>
        <Input id="full_name" name="full_name" defaultValue={values?.full_name} autoComplete="off" required {...fieldAria("full_name", e.full_name)} />
      </Field>
      {email}
    </>
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

// ---------- Create by invitation (public sign-up is the normal path) ----------

/**
 * Full name + email. Supabase Auth creates the account and emails a secure invitation;
 * the user chooses their own password from the link. No password is handled here.
 */
export function InviteUserForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(inviteUser, undefined)
  // Remounting the form is the reset for "Invite another user".
  const [formKey, setFormKey] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const onSubmit = useManualSubmit(formAction, () => setDismissed(false))
  const invited = !dismissed ? state?.invited : undefined
  const e = state && !state.invited ? (state.fieldErrors ?? {}) : {}

  if (invited) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="flex items-start gap-2 rounded-md border border-[var(--success-border)] bg-[var(--success-surface)] px-3 py-2.5 text-sm text-[var(--success)]">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Invitation sent to {invited.email}.</span>
        </p>
        <p className="text-sm text-muted-foreground">
          The account shows as &ldquo;Awaiting first login&rdquo; until the user opens the invitation and sets a password.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/users" className={buttonVariants()}>Back to Users</Link>
          <Button type="button" variant="ghost" onClick={() => { setFormKey((k) => k + 1); setDismissed(true) }}>
            Invite another user
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <ProfileFields
          errors={e}
          email={
            <Field id="email" label="Email" hint="The invitation is sent here; it becomes the sign-in email." error={e.email}>
              <Input id="email" name="email" type="email" autoComplete="off" required {...fieldAria("email", e.email, true)} />
            </Field>
          }
        />
      </div>

      <FormError message={state && !state.invited ? state.error : undefined} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || disabled}>
          <Send aria-hidden="true" />
          {pending ? "Sending invitation…" : "Create account & send invite"}
        </Button>
        <Link href="/admin/users" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}

// ---------- Edit ----------

export function EditUserForm({
  user,
  disabled,
}: {
  user: UserValues
  disabled?: boolean
}) {
  const [state, formAction, pending] = useActionState(updateUser, undefined)
  const onSubmit = useManualSubmit(formAction)
  const formRef = useRef<HTMLFormElement>(null)
  const e = state?.fieldErrors ?? {}

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={user.id} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <ProfileFields
          errors={e}
          values={user}
          email={
            <Field id="email" label="Email" hint="Sign-in email cannot be changed here.">
              <Input id="email" value={user.email} readOnly disabled aria-describedby="email-hint" />
            </Field>
          }
        />
      </div>

      <FormError message={state?.error} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {/* Discards unsaved edits, then returns to the list. */}
        <Link href="/admin/users" onClick={() => formRef.current?.reset()} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
