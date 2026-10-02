"use client"

import { useState, useTransition } from "react"

import { logout } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Asks before signing out. `trigger` is the button that opens it; signing out runs the
 * existing logout action, which redirects to /login.
 */
export function SignOutDialog({ trigger, appName = "Campus Agent" }: { trigger: React.ReactElement; appName?: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    // Stays open while signing out, so Escape or an outside click can't interrupt it.
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger render={trigger} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Sign out?</DialogTitle>
          <DialogDescription>Are you sure you want to sign out of {appName}?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button disabled={pending} onClick={() => startTransition(() => logout())}>
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
