"use client"

import { cn } from "cn"
import { CircleAlert, MailCheck } from "lucide-react"
import Link from "next/link"
import { useActionState, useTransition } from "react"

import { signup } from "@/app/(auth)/actions"
import { PasswordInput } from "@/components/auth/password-input"
import { Field, fieldAria } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pressMotion } from "@/lib/motion"

// Public sign-up: name, email and password only. There is no role field:
// every account created here is a regular user.
export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined)
  const [, startTransition] = useTransition()

  if (state?.confirmEmail) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="flex items-start gap-2.5 rounded-md border bg-muted/50 px-3 py-3 text-sm leading-relaxed">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Almost done. We sent a confirmation link to <span className="font-medium break-all">{state.confirmEmail}</span>.
            Open it to activate your account, then sign in.
          </span>
        </p>
        <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-10 w-full", pressMotion)}>
          Go to sign in
        </Link>
      </div>
    )
  }

  const failed = state && state.confirmEmail === undefined ? state : undefined
  const e = failed?.fieldErrors ?? {}
  const error = failed?.error

  return (
    <form
      // Submit manually so the fields stay filled in after a failed attempt.
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(() => formAction(data))
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field id="full_name" label="Full name" error={e.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required className="h-10" {...fieldAria("full_name", e.full_name)} />
      </Field>

      <Field id="email" label="Email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" {...fieldAria("email", e.email)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="password" label="Password" hint="At least 8 characters." error={e.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            {...fieldAria("password", e.password, true)}
          />
        </Field>
        <Field id="confirm" label="Confirm password" error={e.confirm}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required {...fieldAria("confirm", e.confirm)} />
        </Field>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className={cn("mt-1 h-10 w-full", pressMotion)}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
