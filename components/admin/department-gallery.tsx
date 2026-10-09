"use client"

import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteDepartment, reorderDepartments, setDepartmentPublished } from "@/app/admin/departments/actions"
import { DepartmentDialog, type DepartmentItem } from "@/components/admin/department-dialog"
import { SortableCardGrid } from "@/components/admin/sortable-card-grid"
import { StatusBadge } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
type Result = { ok: true } | { ok: false; error: string }

/** `defaultOpen`: opened from a link such as the dashboard's "Add Department" (?new=1). */
export function AddDepartmentButton({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { toast, showToast } = useToast()
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Add department
      </Button>
      <DepartmentDialog open={open} onOpenChange={setOpen} onSaved={showToast} />
      {toast}
    </>
  )
}

/**
 * Department cards, reorderable by press-and-hold then drag; the order is saved for
 * everyone. Dialogs live outside the sortable cards so typing in them never starts a drag.
 */
export function DepartmentGallery({ departments }: { departments: DepartmentItem[] }) {
  const router = useRouter()
  const { toast, showToast } = useToast()
  const [dialog, setDialog] = useState<{ mode: "edit" | "delete"; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const selected = departments.find((d) => d.id === dialog?.id)

  function run(action: () => Promise<Result>, message: string, after?: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setError(result.error)
        after?.()
        showToast(message)
        router.refresh()
      } catch {
        setError("The request could not be completed. Refresh the page to check the current state.")
      }
    })
  }

  function closeDelete(next: boolean) {
    if (pending) return
    if (!next) { setDialog(null); setError(null) }
  }

  const togglePublished = (department: DepartmentItem) =>
    run(() => setDepartmentPublished(department.id, !department.published), department.published ? "Department unpublished." : "Department published.")

  return (
    <>
      {error && dialog === null && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <SortableCardGrid
        id="department-gallery"
        noun="department"
        label="Departments"
        onSave={reorderDepartments}
        cards={departments.map((department) => ({
          id: department.id,
          title: department.name,
          sortable: true,
          node: (
            <DepartmentCard
              department={department}
              busy={pending}
              onEdit={() => { setError(null); setDialog({ mode: "edit", id: department.id }) }}
              onDelete={() => { setError(null); setDialog({ mode: "delete", id: department.id }) }}
              onTogglePublished={() => togglePublished(department)}
            />
          ),
        }))}
      />

      {selected && (
        <DepartmentDialog
          key={JSON.stringify(selected)}
          open={dialog?.mode === "edit"}
          onOpenChange={(next) => setDialog(next ? { mode: "edit", id: selected.id } : null)}
          department={selected}
          onSaved={showToast}
        />
      )}

      <Dialog open={dialog?.mode === "delete" && !!selected} onOpenChange={closeDelete}>
        {selected && (
          <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>Delete “{selected.name}”?</DialogTitle>
              <DialogDescription>
                {selected.accounts > 0
                  ? `${plural(selected.accounts, "account")} ${selected.accounts === 1 ? "uses" : "use"} this department or one of its programs, so it cannot be deleted. Unpublish it instead to hide it.`
                  : selected.programs.length
                    ? `The department and its ${plural(selected.programs.length, "program")} will be permanently deleted. This cannot be undone.`
                    : "The department will be permanently deleted. This cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" size="lg" disabled={pending} onClick={() => closeDelete(false)}>{selected.accounts > 0 ? "Close" : "Cancel"}</Button>
              {selected.accounts === 0 && (
                <Button variant="destructive" size="lg" disabled={pending} onClick={() => run(() => deleteDepartment(selected.id), "Department deleted.", () => setDialog(null))}>
                  {pending ? "Deleting…" : "Delete department"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {toast}
    </>
  )
}

function DepartmentCard({ department, busy, onEdit, onDelete, onTogglePublished }: {
  department: DepartmentItem
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublished: () => void
}) {
  return (
    <article className="relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/40">
      {/* Fixed 16:9 media area (the same crop as the edit preview). The image is positioned
          absolutely so a tall upload can never change the card height. */}
      <div className="relative aspect-video shrink-0 border-b bg-muted">
        {department.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- public storage URL, replaced on edit
          <img src={department.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 size-full object-cover" style={{ objectPosition: `${department.coverPosition.x}% ${department.coverPosition.y}%` }} />
        )}
        <span className="absolute -bottom-6 left-4 flex size-12 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-sm">
          {department.logoUrl
            // eslint-disable-next-line @next/next/no-img-element -- public storage URL, replaced on edit
            ? <img src={department.logoUrl} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-contain p-1" />
            : <span className="text-xs font-semibold text-muted-foreground" aria-hidden="true">{department.shortName.slice(0, 4)}</span>}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-4 pt-8 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="leading-snug font-semibold">
              <button type="button" onClick={onEdit} className="cursor-pointer text-left outline-none hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring">
                {department.name}
              </button>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{department.shortName}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${department.name}`} className="-mr-1.5 shrink-0" />}>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-40">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onClick={onTogglePublished}>
                {department.published ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {department.published ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {department.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{department.description}</p>}
        <div className="flex-1" />
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span>{plural(department.programs.length, "program")}</span>
          <StatusBadge status={department.published ? "published" : "draft"} />
        </div>
      </div>
    </article>
  )
}
