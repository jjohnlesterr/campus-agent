"use client"

import { reorderCollectionSources } from "@/app/admin/knowledge/collections/actions"
import { type GridCard, SortableCardGrid } from "@/components/admin/sortable-card-grid"

export type { GridCard }

/**
 * Knowledge Library cards in a collection, reorderable by press-and-hold then drag.
 *
 * `sourceIds` is every source in the collection in its saved order; the visible cards
 * may be a filtered subset, whose new order is saved into the same positions.
 */
export function SortableSourceGrid({ collectionId, sourceIds, cards }: { collectionId: string | null; sourceIds: string[]; cards: GridCard[] }) {
  function save(next: string[]) {
    // The visible cards' new order fills the positions they held in the whole collection.
    const shown = new Set(next)
    const queue = [...next]
    const all = sourceIds.map((id) => (shown.has(id) ? queue.shift()! : id))
    return reorderCollectionSources({ collectionId, ids: all })
  }
  return (
    <SortableCardGrid
      id={`source-grid-${collectionId ?? "uncategorized"}`}
      cards={cards}
      noun="source"
      label="Sources and entries"
      onSave={save}
    />
  )
}
