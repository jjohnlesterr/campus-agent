"use client"

import { useEffect, useState } from "react"

import { formatDate, formatTime } from "@/lib/datetime"

// Current date and time in the school's timezone; ticks every 30 seconds.
export function DashboardClock({ initialIso, timezone }: { initialIso: string; timezone: string }) {
  const [now, setNow] = useState(initialIso)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-left sm:text-right">
      {/* Server and browser ICU can format spaces differently; the text is refreshed on mount anyway. */}
      <p className="text-sm font-medium" suppressHydrationWarning>
        {formatDate(now, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground tabular-nums" suppressHydrationWarning>
        <time dateTime={now}>{formatTime(now, timezone)}</time>
      </p>
    </div>
  )
}
