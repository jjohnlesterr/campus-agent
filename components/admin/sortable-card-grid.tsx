"use client"

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export type GridCard = { id: string; title: string; sortable: boolean; node: React.ReactNode }
type SaveResult = { ok: true } | { ok: false; error: string }

/** Buttons, fields and menus inside a card keep working: pressing them never starts a drag. */
const onControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("button, input, textarea, select, [role='menuitem'], [data-no-drag]")

class CardMouseSensor extends MouseSensor {
  static activators = [{ eventName: "onMouseDown" as const, handler: ({ nativeEvent }: React.MouseEvent) => nativeEvent.button === 0 && !onControl(nativeEvent.target) }]
}
class CardTouchSensor extends TouchSensor {
  static activators = [{ eventName: "onTouchStart" as const, handler: ({ nativeEvent }: React.TouchEvent) => nativeEvent.touches.length === 1 && !onControl(nativeEvent.target) }]
}

/** Drag movement (px) under which a press-and-release still counts as a click on the card. */
const CLICK_DISTANCE = 5

/**
 * A card grid reorderable by press-and-hold then drag (no visible handle). A quick click
 * still opens the card. Keyboard: focus a card, press Space, move with the arrow keys,
 * Space again to drop (Escape cancels).
 *
 * `onSave` receives the sortable cards' new order; the new order shows at once and is
 * reverted with the error when saving fails. `noun` names one card in announcements.
 * `variant="list"` lays the items out as full-width rows (divided, no gaps) instead of a grid.
 */
export function SortableCardGrid({ id, cards, noun, label, onSave, variant = "grid" }: {
  id: string
  cards: GridCard[]
  noun: string
  label: string
  onSave: (ids: string[]) => Promise<SaveResult>
  variant?: "grid" | "list"
}) {
  const list = variant === "list"
  const router = useRouter()
  const visible = cards.filter((card) => card.sortable).map((card) => card.id)
  const key = visible.join(",")
  const [local, setLocal] = useState<{ base: string; ids: string[] } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const order = local && local.base === key ? local.ids : visible
  const byId = new Map(cards.map((card) => [card.id, card]))
  const title = (cardId: string | number | null | undefined) => byId.get(String(cardId))?.title ?? noun

  const sensors = useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function onDragStart({ active }: DragStartEvent) {
    setError(null)
    setActiveId(String(active.id))
    document.body.style.cursor = "grabbing"
  }

  function endDrag() {
    setActiveId(null)
    document.body.style.cursor = ""
  }

  function onDragEnd({ active, over, delta }: DragEndEvent) {
    endDrag()
    // The mouseup that ends a real drag would also click the card's link: swallow it.
    if (Math.hypot(delta.x, delta.y) >= CLICK_DISTANCE) {
      const swallow = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation() }
      window.addEventListener("click", swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0)
    }
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    setLocal({ base: key, ids: next })
    setSaving(true)
    onSave(next)
      .then((result) => {
        if (result.ok) return router.refresh()
        setLocal(null)
        setError(result.error)
      })
      .catch(() => {
        setLocal(null)
        setError("The new order could not be saved. Refresh the page and try again.")
      })
      .finally(() => setSaving(false))
  }

  return (
    <>
      <div aria-live="polite" className={cn("min-h-0", list && (saving || error) && "mb-3")}>
        {saving && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Saving order…</p>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
        accessibility={{
          screenReaderInstructions: { draggable: `To reorder, press Space, move the ${noun} with the arrow keys, then press Space again to drop it. Press Escape to cancel.` },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
            onDragOver: ({ active, over }) => (over ? `${title(active.id)} is now at position ${order.indexOf(String(over.id)) + 1} of ${order.length}.` : undefined),
            onDragEnd: ({ active, over }) => (over ? `${title(active.id)} dropped at position ${order.indexOf(String(over.id)) + 1} of ${order.length}.` : `${title(active.id)} dropped.`),
            onDragCancel: ({ active }) => `Reordering cancelled. ${title(active.id)} is back in place.`,
          },
        }}
      >
        <SortableContext id={`${id}-items`} items={order} strategy={list ? verticalListSortingStrategy : rectSortingStrategy}>
          <ul className={list ? "flex flex-col gap-2.5" : "mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"} aria-label={label}>
            {order.map((cardId) => <SortableCard key={cardId} id={cardId} title={title(cardId)} noun={noun} list={list}>{byId.get(cardId)?.node}</SortableCard>)}
            {cards.filter((card) => !card.sortable).map((card) => <li key={card.id} className="flex">{card.node}</li>)}
          </ul>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
          {activeId && (
            <div className={cn("pointer-events-none flex h-full cursor-grabbing rounded-lg shadow-lg ring-1 ring-primary/25", list ? "scale-[1.01] [&>*]:border-primary/40" : "scale-[1.015] [&>article]:border-primary/40")}>
              {byId.get(activeId)?.node}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  )
}

function SortableCard({ id, title, noun, list, children }: { id: string; title: string; noun: string; list: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    attributes: { role: "listitem", roleDescription: `sortable ${noun}` },
  })
  return (
    <li
      ref={(element) => { setNodeRef(element); setActivatorNodeRef(element) }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={title}
      className={cn(
        "flex outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "rounded-lg focus-visible:ring-offset-2",
        // The item's place while it is dragged: a quiet placeholder marking where it will drop.
        // In a list it is an empty dashed slot: the insertion gap where the row will drop.
        isDragging && (list ? "[&>*]:border-dashed [&>*]:border-primary/50 [&>*]:bg-accent/30 [&>*>*]:opacity-0" : "opacity-40")
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  )
}
