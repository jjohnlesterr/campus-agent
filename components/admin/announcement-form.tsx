"use client"

import { cn } from "cn"
import { ImagePlus, RotateCcw, Upload, X } from "lucide-react"
import Link from "next/link"
import { startTransition, useActionState, useEffect, useRef, useState } from "react"

import { saveAnnouncement } from "@/app/admin/announcements/actions"
import { CENTER_POSITION, ImageCrop, type ImagePosition, isCentered } from "@/components/admin/image-crop"
import { Field, fieldAria, selectClass, textareaClass } from "@/components/shared/form-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AnnouncementScope } from "@/lib/announcement-scopes"
import { ANNOUNCEMENT_BUCKET, ANNOUNCEMENT_IMAGE_EXTENSIONS, MAX_ANNOUNCEMENT_IMAGE_BYTES } from "@/lib/announcement-images"
import { createClient } from "@/lib/supabase/client"

export type AnnouncementFormValues = {
  id?: string
  title: string
  content: string
  date: string
  sourceLabel: string
  sourceUrl: string
  imageUrl: string | null
  /** Where the image sits in its crop window (CSS object-position, %). */
  imagePosition: ImagePosition
  /** null = University-wide; otherwise the department this announcement is for. */
  departmentId: string | null
  /** Current status of a saved announcement; a new one has none yet. */
  status?: "draft" | "published" | "archived"
}

type ImageState = { kind: "current"; url: string } | { kind: "none" } | { kind: "new"; file: File; preview: string }

const STATUS_NOTE = {
  new: "Not saved yet. Publish shows it to everyone; Save draft keeps it admin-only.",
  draft: "Only admins can see it. Publish to show it to everyone.",
  published: "Visible to everyone and to Campus Agent.",
  archived: "Hidden from users and Campus Agent. Publish or save a draft to restore it.",
}

/**
 * University-wide announcement, curated by hand from an official post: the content editor,
 * and a Publishing panel (status, date, source, actions) beside it on wide screens and
 * below it on smaller ones. "Save draft" keeps it admin-only; "Publish" shows it to
 * everyone. A new image is uploaded to Storage when the form is submitted.
 */
export function AnnouncementForm({ values, sourcePlaceholder, scopes }: { values: AnnouncementFormValues; sourcePlaceholder: string; scopes: AnnouncementScope[] }) {
  const [state, formAction, saving] = useActionState(saveAnnouncement, undefined)
  const [image, setImage] = useState<ImageState>(values.imageUrl ? { kind: "current", url: values.imageUrl } : { kind: "none" })
  const [uploading, setUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [position, setPosition] = useState<ImagePosition>(values.imagePosition)
  const inputRef = useRef<HTMLInputElement>(null)
  const pending = saving || uploading
  const e = state?.fieldErrors ?? {}
  const preview = image.kind === "current" ? image.url : image.kind === "new" ? image.preview : null
  const imageMessage = imageError ?? e.image

  // Release the local preview when it is replaced or the form goes away.
  const previewUrl = image.kind === "new" ? image.preview : null
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    if (!ANNOUNCEMENT_IMAGE_EXTENSIONS[file.type]) return setImageError("Choose a PNG, JPG or WebP image.")
    if (file.size === 0 || file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) return setImageError("The image must be 5 MB or smaller.")
    setImageError(null)
    setImage({ kind: "new", file, preview: URL.createObjectURL(file) })
    setPosition(CENTER_POSITION)
  }

  function onDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragOver(false)
    if (!pending) choose(event.dataTransfer.files?.[0])
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    let uploaded: string | null = null
    if (image.kind === "new") {
      setUploading(true)
      const path = `announcements/${crypto.randomUUID()}.${ANNOUNCEMENT_IMAGE_EXTENSIONS[image.file.type]}`
      try {
        const { error } = await createClient().storage.from(ANNOUNCEMENT_BUCKET).upload(path, image.file, { contentType: image.file.type, upsert: false })
        if (error) throw error
        uploaded = path
      } catch {
        setUploading(false)
        return setImageError("The image could not be uploaded. Please try again.")
      }
      setUploading(false)
    }
    const changed = image.kind === "new" ? uploaded! : image.kind === "none" && values.imageUrl ? "remove" : "keep"
    formData.set("image", changed)
    formData.set("image_position_x", String(position.x))
    formData.set("image_position_y", String(position.y))
    // The server action verifies the upload, and removes it again if the save fails.
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={submit} className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <section aria-labelledby="announcement-content-heading" className="min-w-0 rounded-lg border bg-background">
        <h2 id="announcement-content-heading" className="border-b px-5 py-3.5 text-sm font-semibold">Announcement content</h2>
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <Field id="title" label="Title" error={e.title}>
            <Input
              id="title"
              name="title"
              defaultValue={values.title}
              maxLength={200}
              required
              placeholder="e.g. Second semester enrollment schedule"
              className="h-11 text-base font-medium md:text-base"
              {...fieldAria("title", e.title)}
            />
          </Field>

          <Field id="content" label="Content" error={e.content}>
            <textarea
              id="content"
              name="content"
              defaultValue={values.content}
              maxLength={8000}
              required
              placeholder="Write the announcement as it was officially posted."
              className={cn(textareaClass, "min-h-72 resize-y leading-relaxed")}
              {...fieldAria("content", e.content)}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span id="image-label" className="text-sm font-medium">
              Announcement image <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => choose(event.target.files?.[0])}
            />
            {preview ? (
              <>
                {/* Fixed 16:9 crop window; dragging repositions the image. A file dropped here replaces it. */}
                <div
                  onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={cn("w-full max-w-2xl rounded-lg", dragOver && "ring-2 ring-primary")}
                >
                  <ImageCrop src={preview} label="Announcement image" position={position} onChange={setPosition} disabled={pending} hintId="image-position-hint" />
                </div>
                <p id="image-position-hint" className="text-xs text-muted-foreground">Drag image to adjust position</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={pending} aria-describedby="image-label" onClick={() => inputRef.current?.click()}>
                    <Upload aria-hidden="true" />
                    Replace
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={pending} aria-describedby="image-label" onClick={() => { setImageError(null); setImage({ kind: "none" }); setPosition(CENTER_POSITION) }}>
                    <X aria-hidden="true" />
                    Remove
                  </Button>
                  {!isCentered(position) && (
                    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setPosition(CENTER_POSITION)}>
                      <RotateCcw aria-hidden="true" />
                      Reset position
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                aria-describedby="image-label image-hint"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "flex aspect-[3/1] w-full max-w-2xl cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center transition-colors outline-none hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  dragOver && "border-primary bg-accent/40"
                )}
              >
                <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">Drop an image here, or click to upload</span>
                <span className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 5 MB</span>
              </button>
            )}
            <p id="image-hint" className={imageMessage ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={imageMessage ? "alert" : undefined}>
              {imageMessage ?? "Optional image from the official announcement."}
            </p>
          </div>
        </div>
      </section>

      <aside aria-labelledby="publishing-heading" className="rounded-lg border bg-background lg:sticky lg:top-6">
        <h2 id="publishing-heading" className="border-b px-5 py-3.5 text-sm font-semibold">Publishing</h2>
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Status</span>
            <div><StatusBadge status={values.status ?? "draft"} label={values.status ? undefined : "New"} /></div>
            <p className="text-xs text-muted-foreground">{STATUS_NOTE[values.status ?? "new"]}</p>
          </div>

          <Field id="scope" label="Announcement category" hint="Where it comes from. Every published announcement is visible to all users." error={e.scope}>
            <select id="scope" name="scope" defaultValue={values.departmentId ?? ""} className={selectClass} {...fieldAria("scope", e.scope, true)}>
              {scopes.map((s) => <option key={s.code} value={s.departmentId ?? ""}>{s.label}</option>)}
            </select>
          </Field>

          <Field id="date" label="Published date" hint="Shown on the announcement; newest appear first." error={e.date}>
            <Input id="date" name="date" type="date" defaultValue={values.date} required {...fieldAria("date", e.date, true)} />
          </Field>

          <fieldset className="flex flex-col gap-4 border-t pt-5">
            <legend className="sr-only">Source</legend>
            <p aria-hidden="true" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Source</p>
            <Field id="source_label" label="Source label" optional hint={sourcePlaceholder} error={e.source_label}>
              <Input id="source_label" name="source_label" defaultValue={values.sourceLabel} maxLength={200} {...fieldAria("source_label", e.source_label, true)} />
            </Field>
            <Field id="source_url" label="Source URL" optional hint="Paste the link to the original official post or notice." error={e.source_url}>
              <Input id="source_url" name="source_url" type="url" inputMode="url" defaultValue={values.sourceUrl} placeholder="https://" maxLength={2000} {...fieldAria("source_url", e.source_url, true)} />
            </Field>
          </fieldset>

          {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          {Object.keys(e).length > 0 && !state?.error && <p role="alert" className="text-sm text-destructive">Check the highlighted fields.</p>}

          <div className="flex flex-col gap-2 border-t pt-5">
            <Button type="submit" name="intent" value="published" size="lg" disabled={pending} className="w-full">
              {uploading ? "Uploading image…" : saving ? "Saving…" : "Publish"}
            </Button>
            <Button type="submit" name="intent" value="draft" variant="outline" size="lg" disabled={pending} className="w-full">
              Save draft
            </Button>
            <Link href="/admin/announcements" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
              Cancel
            </Link>
          </div>
        </div>
      </aside>
    </form>
  )
}
