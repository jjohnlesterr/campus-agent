"use client"

import { CircleCheck } from "lucide-react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

const noSubscription = () => () => {}

/** False during server rendering and hydration, true once mounted in the browser. */
function useMounted() {
  return useSyncExternalStore(noSubscription, () => true, () => false)
}

/**
 * A small confirmation toast (bottom-right, announced politely, gone after a few
 * seconds). Render `toast` once in the component that calls `showToast`.
 */
export function useToast(duration = 4000) {
  const [message, setMessage] = useState<string | null>(null)
  const mounted = useMounted()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function showToast(text: string) {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), duration)
  }

  // The portal needs document.body: render it only after mounting, so the server HTML and
  // the first client render (hydration) match.
  const toast =
    !mounted
      ? null
      : createPortal(
          <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-[calc(100%-2rem)] justify-end">
            {message && (
              <p role="status" className="flex items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
                <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {message}
              </p>
            )}
          </div>,
          document.body
        )

  return { toast, showToast }
}
