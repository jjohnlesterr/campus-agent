import "server-only"

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

// Free questions for signed-out visitors on the landing page. The count lives in an
// httpOnly cookie signed with a server secret: the browser can't read or change it,
// so refreshing (or editing the cookie) doesn't reset it. Clearing cookies does — this
// stops casual resets, it is not anti-fraud. Only successful answers are counted.

export const GUEST_QUESTION_LIMIT = 3

export const GUEST_LIMIT_MESSAGE =
  "You’ve used your free questions. Create an account to continue using Campus Agent and save your conversations."

const COOKIE = "ca_guest"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90

export type GuestQuota = { id: string; used: number }

let fallbackKey: Buffer | undefined

/**
 * Signing key derived from GUEST_SESSION_SECRET (or, if unset, the server-only
 * Anthropic key). Without either, a per-process key is used: counts then reset when
 * the server restarts, which is acceptable for local development.
 */
function signingKey() {
  const secret = process.env.GUEST_SESSION_SECRET || process.env.ANTHROPIC_API_KEY
  if (secret) return createHmac("sha256", secret).update("campus-agent guest quota v1").digest()
  fallbackKey ??= randomBytes(32)
  return fallbackKey
}

function signature(payload: string, key: Buffer) {
  return createHmac("sha256", key).update(payload).digest("base64url")
}

export function encodeGuestToken(quota: GuestQuota, key: Buffer = signingKey()) {
  const payload = `${quota.id}.${quota.used}`
  return `${payload}.${signature(payload, key)}`
}

/** The quota in a cookie value, or null when it is missing, malformed or not signed by this server. */
export function decodeGuestToken(token: string | undefined, key: Buffer = signingKey()): GuestQuota | null {
  const match = token?.match(/^([0-9a-f-]{36})\.(\d{1,3})\.([A-Za-z0-9_-]+)$/)
  if (!match) return null
  const [, id, used, sig] = match
  const expected = Buffer.from(signature(`${id}.${used}`, key))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  return { id, used: Number(used) }
}

export function remainingQuestions(quota: GuestQuota) {
  return Math.max(0, GUEST_QUESTION_LIMIT - quota.used)
}

/** This visitor's quota. A missing or tampered cookie starts a fresh one (it is only written after a success). */
export async function readGuestQuota(): Promise<GuestQuota> {
  const store = await cookies()
  return decodeGuestToken(store.get(COOKIE)?.value) ?? { id: randomUUID(), used: 0 }
}

/** Records one more successful question. Only callable from a Server Action or Route Handler. */
export async function recordGuestQuestion(quota: GuestQuota): Promise<GuestQuota> {
  const next = { id: quota.id, used: Math.min(quota.used + 1, GUEST_QUESTION_LIMIT) }
  const store = await cookies()
  store.set(COOKIE, encodeGuestToken(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
  return next
}
