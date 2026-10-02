"use client"

import { Menu } from "@base-ui/react/menu"
import { Ellipsis, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteConversation } from "@/app/app/(shell)/chat/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CONVERSATION_DELETED_EVENT } from "@/lib/ai/chat-types"

/** Three-dot menu for a Recent conversations row, with a confirmed delete. */
export function ConversationActions({
  conversation,
  onDeleted,
}: {
  conversation: { id: string; title: string }
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirmDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteConversation(conversation.id).catch(() => null)
      if (!result?.ok) {
        setError(result?.error ?? "This conversation could not be deleted. Please try again.")
        return
      }
      setConfirmOpen(false)
      window.dispatchEvent(new CustomEvent(CONVERSATION_DELETED_EVENT, { detail: conversation.id }))
      // Read the real address: a new chat moves to /app/chat/[id] via history.replaceState.
      if (window.location.pathname === `/app/chat/${conversation.id}`) router.replace("/app")
      onDeleted(conversation.id)
    })
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`More options for “${conversation.title}”`}
          className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-[opacity,color,background-color] outline-none group-focus-within:opacity-100 group-hover:opacity-100hover:bg-background/70 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-background/70 data-popup-open:text-foreground data-popup-open:opacity-100 [@media(hover:hover)]:opacity-0"
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="min-w-44 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
              <Menu.Item
                onClick={() => {
                  setError(null)
                  setConfirmOpen(true)
                }}
                className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-destructive outline-none select-none data-highlighted:bg-destructive/10"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete conversation
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This conversation and its messages will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
