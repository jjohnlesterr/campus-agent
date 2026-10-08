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
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { reorderCollectionSources } from "@/app/admin/knowledge/collections/actions"

export type GridCard = { id: string; title: string; sortable: boolean; node: React.ReactNode }

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
 * Knowledge Library cards in a collection, reorderable by press-and-hold then drag (no
 * visible handle). A quick click still opens the card. Keyboard: focus a card, press
 * Space, move with the arrow keys, Space again to drop (Escape cancels).
 *
 * `sourceIds` is every source in the collection in its saved order; the visible cards
 * may be a filtered subset, whose new order is saved into the same positions.
 */
export function SortableSourceGrid({ collectionId, sourceIds, cards }: { collectionId: string | null; sourceIds: string[]; cards: GridCard[] }) {
  const router = useRouter()
  const visible = cards.filter((card) => card.sortable).map((card) => card.id)
  const key = visible.join(",")
  const [local, setLocal] = useState<{ base: string; ids: string[] } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const order = local && local.base === key ? local.ids : visible
  const byId = new Map(cards.map((card) => [card.id, card]))
  const title = (id: string | number | null | undefined) => byId.get(String(id))?.title ?? "Source"

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

    // The visible cards' new order fills the positions they held in the whole collection.
    const shown = new Set(next)
    const queue = [...next]
    const all = sourceIds.map((id) => (shown.has(id) ? queue.shift()! : id))
    setSaving(true)
    reorderCollectionSources({ collectionId, ids: all })
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
      <div aria-live="polite" className="min-h-0">
        {saving && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Saving order…</p>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
      <DndContext
        id={`source-grid-${collectionId ?? "uncategorized"}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
        accessibility={{
          screenReaderInstructions: { draggable: "To reorder, press Space, move the source with the arrow keys, then press Space again to drop it. Press Escape to cancel." },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
            onDragOver: ({ active, over }) => (over ? `${title(active.id)} is now at position ${order.indexOf(String(over.id)) + 1} of ${order.length}.` : undefined),
            onDragEnd: ({ active, over }) => (over ? `${title(active.id)} dropped at position ${order.indexOf(String(over.id)) + 1} of ${order.length}.` : `${title(active.id)} dropped.`),
            onDragCancel: ({ active }) => `Reordering cancelled. ${title(active.id)} is back in place.`,
          },
        }}
      >
        <SortableContext id={`source-grid-items-${collectionId ?? "uncategorized"}`} items={order} strategy={rectSortingStrategy}>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Sources and entries">
            {order.map((id) => <SortableCard key={id} id={id} title={title(id)}>{byId.get(id)?.node}</SortableCard>)}
            {cards.filter((card) => !card.sortable).map((card) => <li key={card.id} className="flex">{card.node}</li>)}
          </ul>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
          {activeId && (
            <div className="pointer-events-none flex h-full scale-[1.015] cursor-grabbing rounded-lg shadow-lg ring-1 ring-primary/25 [&>article]:border-primary/40">
              {byId.get(activeId)?.node}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  )
}

function SortableCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    attributes: { role: "listitem", roleDescription: "sortable source" },
  })
  return (
    <li
      ref={(element) => { setNodeRef(element); setActivatorNodeRef(element) }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={title}
      className={cn(
        "flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // The card's place while it is dragged: a quiet placeholder.
        isDragging && "opacity-40"
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  )
}
