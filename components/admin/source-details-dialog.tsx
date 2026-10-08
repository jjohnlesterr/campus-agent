"use client"

import { cn } from "cn"
import { LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { updateSourceDetails } from "@/app/admin/documents/actions"
import { Field, textareaClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export type SourceDetails = { id: string; title: string; description: string | null }

/**
 * Edit details: a source's title and admin description. Metadata only — the file,
 * analysis and knowledge sections are not touched. `onSaved` runs after a successful save.
 */
export function EditSourceDetailsDialog({ source, open, onOpenChange, onSaved }: {
  source: SourceDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [pending, setPending] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Edit source details</DialogTitle>
          <DialogDescription>Only the title and description change. The file, its knowledge sections and their status stay the same.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so it starts from the current details every time. */}
        <DetailsForm source={source} onPendingChange={setPending} onCancel={() => onOpenChange(false)} onSaved={() => { onOpenChange(false); onSaved() }} />
      </DialogContent>
    </Dialog>
  )
}

function DetailsForm({ source, onPendingChange, onCancel, onSaved }: {
  source: SourceDetails
  onPendingChange: (pending: boolean) => void
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(source.title)
  const [description, setDescription] = useState(source.description ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const busy = (value: boolean) => onPendingChange(value)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    if (title.trim().length < 2) return setError("Enter a title (at least 2 characters).")
    setError(null)
    busy(true)
    startTransition(async () => {
      try {
        const result = await updateSourceDetails(source.id, { title, description })
        if (!result.ok) return setError(result.error)
        onSaved()
        router.refresh()
      } catch {
        setError("The source details could not be saved. Please try again.")
      } finally {
        busy(false)
      }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field id={`source-title-${source.id}`} label="Title">
        <Input id={`source-title-${source.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={pending} aria-invalid={!!error && title.trim().length < 2} />
      </Field>
      <Field id={`source-description-${source.id}`} label="Description" optional hint="Admin note shown on the source card. Not used to answer students.">
        <textarea
          id={`source-description-${source.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          disabled={pending}
          className={cn(textareaClass, "min-h-20 resize-y")}
          aria-describedby={`source-description-${source.id}-hint`}
        />
      </Field>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="lg" disabled={pending || title.trim().length < 2} aria-busy={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  )
}
