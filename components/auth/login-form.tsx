"use client"

import { CircleAlert, Eye, EyeOff } from "lucide-react"
import { useActionState, useState, useTransition } from "react"

import { login } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Sign-in only: accounts are provisioned by an administrator.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined)
  const [, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
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
        <Label htmlFor="email">School email</Label>
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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-10 pr-11"
            aria-describedby={error ? "login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls="password"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
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

      <Button type="submit" size="lg" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
