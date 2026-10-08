"use client"

import { cn } from "cn"
import { FolderInput, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createCollection, deleteCollection, moveToCollection, updateCollection } from "@/app/admin/knowledge/collections/actions"
import { EditSourceDetailsDialog } from "@/components/admin/source-details-dialog"
import { Field, selectClass, textareaClass } from "@/components/shared/form-field"
import { useToast } from "@/components/shared/toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { collectionHref, nonEmptyCollectionMessage } from "@/lib/knowledge/collections"

export type CollectionOption = { id: string; name: string }
type Result = { ok: true } | { ok: false; error: string }

/** Runs a server action, keeping the dialog open with the error if it fails. */
function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function run<T extends Result>(action: () => Promise<T>, onDone: (result: T & { ok: true }) => void) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setError(result.error)
        onDone(result as T & { ok: true })
        router.refresh()
      } catch {
        setError("The request could not be completed. Refresh the page to check the current state.")
      }
    })
  }
  return { pending, error, setError, run, router }
}

/** Name + optional description. Creates a collection, or edits `collection` when given. */
function CollectionFormDialog({ open, onOpenChange, collection }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection?: { id: string; name: string; description: string | null }
}) {
  const { pending, error, setError, run, router } = useAction()
  const [name, setName] = useState(collection?.name ?? "")
  const [description, setDescription] = useState(collection?.description ?? "")

  function close(next: boolean) {
    if (pending) return
    if (!next) {
      setError(null)
      setName(collection?.name ?? "")
      setDescription(collection?.description ?? "")
    }
    onOpenChange(next)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (name.trim().length < 2) return setError("Enter a name (at least 2 characters).")
    const input = { name, description }
    if (collection) run(() => updateCollection(collection.id, input), () => onOpenChange(false))
    else run(() => createCollection(input), (result) => router.push(collectionHref(result.id)))
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{collection ? "Edit collection" : "Create collection"}</DialogTitle>
          <DialogDescription>Collections group sources for admins. Campus Agent still uses Published knowledge from every collection.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field id="collection-name" label="Name">
            <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required disabled={pending} placeholder="e.g. Student Handbook" />
          </Field>
          <Field id="collection-description" label="Description" optional>
            <textarea
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              disabled={pending}
              className={cn(textareaClass, "min-h-20")}
              placeholder="e.g. Official handbook and academic rules used by Campus Agent."
            />
          </Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? (collection ? "Saving…" : "Creating…") : collection ? "Save changes" : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateCollectionButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <FolderPlus aria-hidden="true" />
        Create collection
      </Button>
      <CollectionFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** Edit / Delete for one collection. Deleting is refused while it has sources. */
export function CollectionMenu({ collection, sourceCount }: {
  collection: { id: string; name: string; description: string | null }
  sourceCount: number
}) {
  const [open, setOpen] = useState<"edit" | "delete" | null>(null)
  const { pending, error, setError, run, router } = useAction()

  function closeDelete(next: boolean) {
    if (pending) return
    if (!next) { setOpen(null); setError(null) }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon-lg" aria-label="More collection actions" />}>
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          <DropdownMenuItem onClick={() => setOpen("edit")}>
            <Pencil aria-hidden="true" />
            Edit collection
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setOpen("delete")}>
            <Trash2 aria-hidden="true" />
            Delete collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CollectionFormDialog key={`${collection.name}\n${collection.description}`} open={open === "edit"} onOpenChange={(next) => setOpen(next ? "edit" : null)} collection={collection} />

      <Dialog open={open === "delete"} onOpenChange={closeDelete}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete “{collection.name}”?</DialogTitle>
            <DialogDescription>
              {sourceCount > 0
                ? nonEmptyCollectionMessage(sourceCount)
                : "This empty collection will be deleted. No knowledge is affected."}
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => closeDelete(false)}>{sourceCount > 0 ? "Close" : "Cancel"}</Button>
            {sourceCount === 0 && (
              <Button variant="destructive" size="lg" disabled={pending} onClick={() => run(() => deleteCollection(collection.id), () => router.push("/admin/knowledge"))}>
                {pending ? "Deleting…" : "Delete collection"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type MoveProps = {
  kind: "source" | "manual"
  id: string
  title: string
  currentCollectionId: string | null
  collections: CollectionOption[]
}

/** Picks another collection (or Uncategorized) for a source or manual entry. */
export function MoveToCollectionDialog({ open, onOpenChange, kind, id, title, currentCollectionId, collections, onMoved }: MoveProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMoved?: (collectionId: string | null) => void
}) {
  const { pending, error, setError, run } = useAction()
  const [target, setTarget] = useState(currentCollectionId ?? "")
  const unchanged = target === (currentCollectionId ?? "")

  function close(next: boolean) {
    if (pending) return
    if (!next) { setError(null); setTarget(currentCollectionId ?? "") }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Move “{title}”</DialogTitle>
          <DialogDescription>Only its collection changes. Sections, statuses and Campus Agent answers stay the same.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const collectionId = target || null
            run(() => moveToCollection({ kind, id, collectionId }), () => { onOpenChange(false); onMoved?.(collectionId) })
          }}
        >
          <Field id={`move-${id}`} label="Collection">
            <select id={`move-${id}`} value={target} onChange={(e) => setTarget(e.target.value)} disabled={pending} className={selectClass}>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="">Uncategorized</option>
            </select>
          </Field>
          {collections.length === 0 && <p className="text-sm text-muted-foreground">Create a collection in the Knowledge Library first.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={pending || unchanged}>{pending ? "Moving…" : "Move"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Overflow menu on a Knowledge Library card (sits above the card's full-size link). */
export function LibraryCardMenu({ description, ...props }: MoveProps & { description: string | null }) {
  const [open, setOpen] = useState<"move" | "details" | null>(null)
  const { toast, showToast } = useToast()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${props.title}`} className="relative z-10 cursor-pointer" />}>
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          {props.kind === "source" && (
            <DropdownMenuItem onClick={() => setOpen("details")}>
              <Pencil aria-hidden="true" />
              Edit details
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setOpen("move")}>
            <FolderInput aria-hidden="true" />
            Move to collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MoveToCollectionDialog {...props} open={open === "move"} onOpenChange={(next) => setOpen(next ? "move" : null)} />
      {props.kind === "source" && (
        <EditSourceDetailsDialog
          source={{ id: props.id, title: props.title, description }}
          open={open === "details"}
          onOpenChange={(next) => setOpen(next ? "details" : null)}
          onSaved={() => showToast("Source details updated.")}
        />
      )}
      {toast}
    </>
  )
}

/** "Move to collection" button for detail pages (manual entries). */
export function MoveToCollectionButton(props: MoveProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <FolderInput aria-hidden="true" />
        Move to collection
      </Button>
      <MoveToCollectionDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  )
}
