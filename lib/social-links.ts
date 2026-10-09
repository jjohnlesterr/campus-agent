// Official social links entered by admins (e.g. a department's Facebook page). Shared by
// server actions, pages and client forms (no server-only imports). Links are only stored
// and shown; they are never fetched or scraped.

const FACEBOOK_HOSTS = /^(?:www\.|m\.|web\.|mobile\.)?(?:facebook\.com|fb\.com)$/i

export type LinkResult = { ok: true; url: string | null } | { ok: false; error: string }

/**
 * Trims and checks an optional official page link. Blank → null. "facebook.com/page" gets
 * https://, and Facebook links (m., web., fb.com) become https://www.facebook.com/…;
 * other http(s) links are kept as entered.
 */
export function normalizeFacebookUrl(input: string | null | undefined): LinkResult {
  const value = (input ?? "").trim()
  if (!value) return { ok: true, url: null }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { ok: false, error: "Enter a valid link, such as https://www.facebook.com/YourDepartment." }
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "The link must start with http:// or https://." }
  if (!url.hostname.includes(".")) return { ok: false, error: "Enter a valid link, such as https://www.facebook.com/YourDepartment." }
  if (FACEBOOK_HOSTS.test(url.hostname)) {
    url.protocol = "https:"
    url.hostname = "www.facebook.com"
  }
  const result = url.toString()
  if (result.length > 500) return { ok: false, error: "This link is too long." }
  return { ok: true, url: result }
}

/** A stored link that is safe to render as an external href (http/https only), or null. */
export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}
