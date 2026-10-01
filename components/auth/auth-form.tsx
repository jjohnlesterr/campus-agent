"use client"

import Link from "next/link"
import { useActionState } from "react"

import { login, signup } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const copy = {
  login: {
    action: login,
    submit: "Sign in",
    pending: "Signing in…",
    passwordAutoComplete: "current-password",
    switchText: "New to Campus Agent?",
    switchLink: { href: "/signup", label: "Create an account" },
  },
  signup: {
    action: signup,
    submit: "Create account",
    pending: "Creating account…",
    passwordAutoComplete: "new-password",
    switchText: "Already have an account?",
    switchLink: { href: "/login", label: "Sign in" },
  },
} as const

export function AuthForm({ mode }: { mode: keyof typeof copy }) {
  const c = copy[mode]
  const [state, formAction, pending] = useActionState(c.action, undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">School email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state?.error)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={c.passwordAutoComplete}
          minLength={mode === "signup" ? 8 : undefined}
          required
          aria-invalid={Boolean(state?.error)}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? c.pending : c.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {c.switchText}{" "}
        <Link href={c.switchLink.href} className="font-medium text-foreground underline-offset-4 hover:underline">
          {c.switchLink.label}
        </Link>
      </p>
    </form>
  )
}
