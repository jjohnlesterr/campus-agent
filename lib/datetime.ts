// Date helpers for the school's timezone (system_settings.timezone, e.g. Asia/Manila).
// Admins enter local dates/times; the database stores UTC timestamps.

function offsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second)
  return asUtc - at.getTime()
}

/** "2026-10-08" + "14:30" in `timeZone` → UTC ISO string. */
export function zonedToUtcIso(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number)
  const [h, min] = time.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, h, min)
  return new Date(guess - offsetMs(new Date(guess), timeZone)).toISOString()
}

/** UTC ISO string → { date: "YYYY-MM-DD", time: "HH:MM" } in `timeZone`, for form defaults. */
export function utcIsoToZonedInputs(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso))
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` }
}

/** Start of "today" in `timeZone`, as a UTC ISO string. */
export function startOfTodayIso(timeZone: string) {
  return zonedToUtcIso(utcIsoToZonedInputs(new Date().toISOString(), timeZone).date, "00:00", timeZone)
}

export function formatDate(iso: string, timeZone: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    ...(options ?? { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
  }).format(new Date(iso))
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  )
}
