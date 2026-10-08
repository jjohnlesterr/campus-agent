"use client"

import { cn } from "cn"
import { CircleAlert } from "lucide-react"
import { useActionState, useTransition } from "react"

import { login } from "@/app/(auth)/actions"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { pressMotion } from "@/lib/motion"

// Email and password sign-in for users and admins. The role comes from the database.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined)
  const [, startTransition] = useTransition()
  const error = state?.error

  return (
    <form
      // Submit manually so the email stays filled in after a failed attempt.
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(() => formAction(data))
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-10"
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      {error && (
        <p
          id="login-error"
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className={cn("mt-1 h-10 w-full", pressMotion)}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
