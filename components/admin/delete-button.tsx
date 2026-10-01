"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"

// Deletes after a native confirmation. `action` is a bound server action.
export function DeleteButton({ action, label }: { action: () => Promise<void>; label: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      size="lg"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Delete "${label}"? This cannot be undone.`)) {
          startTransition(() => action())
        }
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  )
}
