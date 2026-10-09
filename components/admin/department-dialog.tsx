"use client"

import { cn } from "cn"
import { GripVertical, ImageIcon, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState, useTransition } from "react"

import { discardDepartmentUploads, saveDepartment } from "@/app/admin/departments/actions"
import { CENTER_POSITION, ImageCrop, type ImagePosition, isCentered } from "@/components/admin/image-crop"
import { useDragOrder } from "@/components/admin/use-drag-order"
import { Field, textareaClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DEPARTMENT_BUCKET, DEPARTMENT_IMAGE_EXTENSIONS, MAX_COVER_BYTES, MAX_LOGO_BYTES } from "@/lib/department-images"
import { createClient } from "@/lib/supabase/client"
import { normalizeFacebookUrl } from "@/lib/social-links"

export type DepartmentItem = {
  id: string
  name: string
  shortName: string
  description: string | null
  /** Official Facebook page (optional). */
  facebookUrl: string | null
  logoUrl: string | null
  coverUrl: string | null
  /** Where the cover sits in its crop window (CSS object-position, %). */
  coverPosition: CoverPosition
  published: boolean
  /** Accounts that point to the department or one of its programs. */
  accounts: number
  programs: { id: string; name: string; code: string }[]
}

export type CoverPosition = ImagePosition
const CENTER = CENTER_POSITION

type ImageState = { kind: "current"; url: string } | { kind: "none" } | { kind: "new"; file: File; preview: string }
type ProgramRow = { key: string; id?: string; name: string; code: string }

const imageFrom = (url: string | null): ImageState => (url ? { kind: "current", url } : { kind: "none" })
const rowsFrom = (department?: DepartmentItem): ProgramRow[] => (department?.programs ?? []).map((p) => ({ key: p.id, ...p }))
// Every cell is placed explicitly: drag handle, wide program name, code, delete.
// Below sm the code moves under the name.
const ROW_COLUMNS = "sm:grid-cols-[2rem_minmax(0,1fr)_10rem_2rem]"
const megabytes = (bytes: number) => `${bytes / 1024 / 1024} MB`

/** Add or edit a department with its logo, cover image and programs. Nothing is saved until Save. */
export function DepartmentDialog({ open, onOpenChange, department, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  department?: DepartmentItem
  onSaved?: (message: string) => void
}) {
  const router = useRouter()
  const formId = useId()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(department?.name ?? "")
  const [shortName, setShortName] = useState(department?.shortName ?? "")
  const [description, setDescription] = useState(department?.description ?? "")
  const [facebookUrl, setFacebookUrl] = useState(department?.facebookUrl ?? "")
  const [logo, setLogo] = useState<ImageState>(imageFrom(department?.logoUrl ?? null))
  const [cover, setCover] = useState<ImageState>(imageFrom(department?.coverUrl ?? null))
  const [coverPosition, setCoverPosition] = useState<CoverPosition>(department?.coverPosition ?? CENTER)
  const [programs, setPrograms] = useState<ProgramRow[]>(rowsFrom(department))
  const lastProgram = useRef<HTMLInputElement>(null)

  function reset() {
    for (const image of [logo, cover]) if (image.kind === "new") URL.revokeObjectURL(image.preview)
    setError(null)
    setName(department?.name ?? "")
    setShortName(department?.shortName ?? "")
    setDescription(department?.description ?? "")
    setFacebookUrl(department?.facebookUrl ?? "")
    setLogo(imageFrom(department?.logoUrl ?? null))
    setCover(imageFrom(department?.coverUrl ?? null))
    setCoverPosition(department?.coverPosition ?? CENTER)
    setPrograms(rowsFrom(department))
  }

  function close(next: boolean) {
    if (pending) return
    if (!next) reset()
    onOpenChange(next)
  }

  function updateProgram(key: string, change: Partial<ProgramRow>) {
    setPrograms((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)))
  }

  function addProgram() {
    setPrograms((rows) => [...rows, { key: crypto.randomUUID(), name: "", code: "" }])
    // Focus the new row's name once it renders.
    requestAnimationFrame(() => lastProgram.current?.focus())
  }

  /** undefined keeps the saved image, null removes it, a path is the new upload. */
  const target = (image: ImageState, saved: string | null | undefined) =>
    image.kind === "current" ? undefined : image.kind === "none" ? (saved ? null : undefined) : image

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (name.trim().length < 2) return setError("Enter the department name.")
    if (!shortName.trim()) return setError("Enter a short name, such as CECT.")
    // Checked here too (the server is authoritative), so a bad link fails before any upload.
    const link = normalizeFacebookUrl(facebookUrl)
    if (!link.ok) return setError(link.error)
    if (programs.some((p) => p.name.trim().length < 2)) return setError("Enter a name for every program, or remove the empty rows.")
    setError(null)

    startTransition(async () => {
      const uploaded: string[] = []
      try {
        const upload = async (image: ReturnType<typeof target>) => {
          if (!image || image.kind !== "new") return image as null | undefined
          const path = `departments/${crypto.randomUUID()}.${DEPARTMENT_IMAGE_EXTENSIONS[image.file.type]}`
          const { error: uploadError } = await createClient().storage.from(DEPARTMENT_BUCKET).upload(path, image.file, { contentType: image.file.type, upsert: false })
          if (uploadError) throw new Error("upload")
          uploaded.push(path)
          return path
        }
        let logoPath: string | null | undefined
        let coverPath: string | null | undefined
        try {
          logoPath = await upload(target(logo, department?.logoUrl))
          coverPath = await upload(target(cover, department?.coverUrl))
        } catch {
          if (uploaded.length) await discardDepartmentUploads(uploaded).catch(() => {})
          return setError("An image could not be uploaded. Please try again.")
        }
        const result = await saveDepartment({
          id: department?.id,
          name,
          shortName,
          description,
          facebookUrl,
          logoPath,
          coverPath,
          coverPosition,
          programs: programs.map(({ id, name: programName, code }) => ({ id, name: programName, code })),
        })
        if (!result.ok) return setError(result.error)
        for (const image of [logo, cover]) if (image.kind === "new") URL.revokeObjectURL(image.preview)
        onOpenChange(false)
        onSaved?.(department ? "Department saved." : "Department added.")
        router.refresh()
      } catch {
        if (uploaded.length) await discardDepartmentUploads(uploaded).catch(() => {})
        setError("The department could not be saved. Refresh the page to check the current state.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{department ? `Edit ${department.name}` : "Add department"}</DialogTitle>
          <DialogDescription>Department details and the programs it offers. Accounts that chose this department are not changed.</DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field id={`${formId}-name`} label="Department name">
              <Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required disabled={pending} placeholder="e.g. College of Engineering and Computer Technology" />
            </Field>
            <Field id={`${formId}-short`} label="Short name">
              <Input id={`${formId}-short`} value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={20} required disabled={pending} placeholder="e.g. CECT" />
            </Field>
          </div>
          <Field id={`${formId}-description`} label="Description" optional>
            <textarea
              id={`${formId}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              disabled={pending}
              className={cn(textareaClass, "min-h-20")}
              placeholder="A short introduction to the department."
            />
          </Field>

          <Field id={`${formId}-facebook`} label="Official Facebook page" optional hint="Link to the department's official Facebook page.">
            <Input
              id={`${formId}-facebook`}
              type="url"
              inputMode="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              maxLength={500}
              disabled={pending}
              placeholder="https://www.facebook.com/..."
              aria-describedby={`${formId}-facebook-hint`}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <ImagePicker label="Logo" kind="logo" image={logo} onChange={setLogo} maxBytes={MAX_LOGO_BYTES} disabled={pending} />
            <ImagePicker label="Cover image" kind="cover" image={cover} onChange={setCover} maxBytes={MAX_COVER_BYTES} disabled={pending} position={coverPosition} onPositionChange={setCoverPosition} />
          </div>

          <ProgramList programs={programs} setPrograms={setPrograms} update={updateProgram} disabled={pending} lastRef={lastProgram} formId={formId} />
          <div>
            <Button type="button" variant="outline" onClick={addProgram} disabled={pending}>
              <Plus aria-hidden="true" />
              Add program
            </Button>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : department ? "Save changes" : "Add department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Programs in their saved order: drag a row's handle (or use Arrow Up/Down on it) to reorder. */
function ProgramList({ programs, setPrograms, update, disabled, lastRef, formId }: {
  programs: ProgramRow[]
  setPrograms: (rows: ProgramRow[]) => void
  update: (key: string, change: Partial<ProgramRow>) => void
  disabled: boolean
  lastRef: React.RefObject<HTMLInputElement | null>
  formId: string
}) {
  const byKey = new Map(programs.map((p) => [p.key, p]))
  const { order, dragging, handleProps, itemRef } = useDragOrder(programs.map((p) => p.key), (keys) => setPrograms(keys.map((k) => byKey.get(k)!)))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Programs offered</legend>
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No programs yet.</p>
      ) : (
        <>
          <div aria-hidden="true" className={cn("hidden gap-2 text-xs text-muted-foreground sm:grid", ROW_COLUMNS)}>
            <span />
            <span>Program name</span>
            <span>Code (optional)</span>
            <span />
          </div>
          <ol className="flex flex-col gap-2">
            {order.map((key, index) => {
              const program = byKey.get(key)!
              return (
                <li
                  key={key}
                  ref={itemRef(key)}
                  className={cn(
                    "grid items-center gap-x-2 gap-y-1.5 rounded-lg grid-cols-[2rem_minmax(0,1fr)_2rem]", ROW_COLUMNS,
                    dragging === key && "bg-background shadow-md ring-1 ring-primary/25"
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Reorder ${program.name || `program ${index + 1}`} (Arrow Up or Down)`}
                    disabled={disabled}
                    className="col-start-1 row-start-1 flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    {...handleProps(key, disabled)}
                  >
                    <GripVertical className="size-4" aria-hidden="true" />
                  </button>
                  <Input
                    ref={index === order.length - 1 ? lastRef : undefined}
                    aria-label={`Program ${index + 1} name`}
                    value={program.name}
                    onChange={(e) => update(key, { name: e.target.value })}
                    maxLength={200}
                    disabled={disabled}
                    placeholder="e.g. Bachelor of Science in Information Technology"
                    className="col-start-2 row-start-1"
                  />
                  <Input
                    id={`${formId}-code-${key}`}
                    aria-label={`Program ${index + 1} code (optional)`}
                    value={program.code}
                    onChange={(e) => update(key, { code: e.target.value })}
                    maxLength={30}
                    disabled={disabled}
                    placeholder="e.g. BSIT"
                    className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${program.name || `program ${index + 1}`}`}
                    disabled={disabled}
                    onClick={() => setPrograms(programs.filter((p) => p.key !== key))}
                    className="col-start-3 row-start-1 text-muted-foreground hover:text-destructive sm:col-start-4"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </fieldset>
  )
}

/**
 * A logo (square) or cover (wide) image: preview, choose, replace or remove before saving.
 * A cover is shown cropped as on the gallery card and can be dragged to reposition it.
 */
function ImagePicker({ label, kind, image, onChange, maxBytes, disabled, position = CENTER, onPositionChange }: {
  label: string
  kind: "logo" | "cover"
  image: ImageState
  onChange: (image: ImageState) => void
  maxBytes: number
  disabled: boolean
  position?: CoverPosition
  onPositionChange?: (position: CoverPosition) => void
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const src = image.kind === "current" ? image.url : image.kind === "new" ? image.preview : null

  function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    if (!DEPARTMENT_IMAGE_EXTENSIONS[file.type]) return setError("Choose a PNG, JPG or WebP image.")
    if (file.size === 0 || file.size > maxBytes) return setError(`The ${label.toLowerCase()} must be ${megabytes(maxBytes)} or smaller.`)
    setError(null)
    if (image.kind === "new") URL.revokeObjectURL(image.preview)
    onChange({ kind: "new", file, preview: URL.createObjectURL(file) })
    onPositionChange?.(CENTER)
  }

  function remove() {
    if (image.kind === "new") URL.revokeObjectURL(image.preview)
    setError(null)
    onChange({ kind: "none" })
    onPositionChange?.(CENTER)
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">{label} <span className="font-normal text-muted-foreground">(optional)</span></span>
      {kind === "cover" && src && onPositionChange ? (
        <ImageCrop src={src} label={label} position={position} onChange={onPositionChange} disabled={disabled} hintId={`${id}-position`} />
      ) : (
        // The whole logo is always shown, never cropped.
        <div className={cn("relative flex items-center justify-center overflow-hidden rounded-lg border bg-muted/50", kind === "logo" ? "aspect-square w-full max-w-40" : "aspect-video w-full")}>
          {src
            // eslint-disable-next-line @next/next/no-img-element -- local previews and storage URLs
            ? <img src={src} alt={`${label} preview`} className="absolute inset-0 size-full object-contain object-center p-3" />
            : <ImageIcon className="size-6 text-muted-foreground/60" aria-hidden="true" />}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled} aria-describedby={`${id}-label`} onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" />
          {src ? "Replace" : "Upload"}
        </Button>
        {src && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-describedby={`${id}-label`} onClick={remove}>
            <X aria-hidden="true" />
            Remove
          </Button>
        )}
        {kind === "cover" && src && onPositionChange && !isCentered(position) && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onPositionChange(CENTER)}>
            <RotateCcw aria-hidden="true" />
            Reset position
          </Button>
        )}
      </div>
      {kind === "cover" && src && onPositionChange && (
        <p id={`${id}-position`} className="text-xs text-muted-foreground">Drag image to adjust position</p>
      )}
      <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
        {error ?? `PNG, JPG or WebP, up to ${megabytes(maxBytes)}.`}
      </p>
    </div>
  )
}
