"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

/** Submit button for a server-action form: disabled with `pendingLabel` while the action runs. */
export function PendingSubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} aria-disabled={pending || undefined} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}
