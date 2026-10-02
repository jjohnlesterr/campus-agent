"use client"

import { SignOutDialog } from "@/components/auth/sign-out-dialog"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return <SignOutDialog trigger={<Button type="button" variant="ghost" size="sm">Sign out</Button>} />
}
