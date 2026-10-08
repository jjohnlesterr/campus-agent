"use client"

import { useActionState } from "react"

import { changePassword } from "@/app/(auth)/actions"
import { Field, fieldAria } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pressMotion } from "@/lib/motion"

export function ChangePasswordForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(changePassword, undefined)
  const e = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Lets password managers save the new password for the right account. */}
      {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
      <Field id="password" label="New password" hint="At least 8 characters." error={e.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          {...fieldAria("password", e.password, true)}
        />
      </Field>
      <Field id="confirm" label="Confirm new password" error={e.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          {...fieldAria("confirm", e.confirm)}
        />
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className={pressMotion}>
        {pending ? "Saving…" : "Save password and continue"}
      </Button>
    </form>
  )
}
