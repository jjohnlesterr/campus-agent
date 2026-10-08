"use client"

import { useRef, useState } from "react"

/**
 * Vertical reordering of a list by a drag handle (pointer events: mouse, pen and touch),
 * with Arrow Up/Down on the focused handle as the keyboard alternative.
 *
 * The new order shows immediately and stays until the list from the server changes
 * (after the save refreshes it). `onCommit` receives the new order once per drop or
 * key press, and a `revert` function to call when saving it fails.
 */
export function useDragOrder(ids: string[], onCommit: (ids: string[], movedId: string, revert: () => void) => void) {
  const key = ids.join(",")
  const [local, setLocal] = useState<{ base: string; ids: string[] } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const items = useRef(new Map<string, HTMLElement>())
  const order = local && local.base === key ? local.ids : ids
  const revert = () => setLocal(null)

  const moved = (list: string[], id: string, to: number) => {
    const rest = list.filter((other) => other !== id)
    return [...rest.slice(0, to), id, ...rest.slice(to)]
  }

  /**
   * Follows the pointer on the window, not with pointer capture: moving the dragged item
   * in the DOM releases capture, which would lose the drop.
   */
  const startDrag = (id: string) => {
    let current = order
    const start = order.join(",")
    setDragging(id)
    const onMove = (event: PointerEvent) => {
      // The new index: how many other items' midpoints are above the pointer.
      const to = current.filter((other) => {
        if (other === id) return false
        const rect = items.current.get(other)?.getBoundingClientRect()
        return rect ? rect.top + rect.height / 2 < event.clientY : false
      }).length
      if (current.indexOf(id) === to) return
      current = moved(current, id, to)
      setLocal({ base: key, ids: current })
    }
    const finish = (dropped: boolean) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
      setDragging(null)
      if (!dropped) revert()
      else if (current.join(",") !== start) onCommit(current, id, revert)
    }
    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
  }

  const handleProps = (id: string, disabled: boolean) => ({
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (disabled || event.button !== 0 || dragging) return
      // No text selection while dragging; keep the handle focused for the arrow keys.
      event.preventDefault()
      event.currentTarget.focus()
      startDrag(id)
    },
    onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
      if (disabled || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
      event.preventDefault()
      const from = order.indexOf(id)
      const to = event.key === "ArrowUp" ? from - 1 : from + 1
      if (to < 0 || to >= order.length) return
      const next = moved(order, id, to)
      setLocal({ base: key, ids: next })
      onCommit(next, id, revert)
    },
  })

  const itemRef = (id: string) => (element: HTMLElement | null) => {
    if (element) items.current.set(id, element)
    else items.current.delete(id)
  }

  return { order, dragging, handleProps, itemRef }
}
