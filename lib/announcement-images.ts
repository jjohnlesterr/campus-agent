// Admin › Announcements: the optional image from the official announcement, in the
// public-assets bucket under announcements/. Shared by server actions and client components.

import { IMAGE_TYPES } from "@/lib/sources"

export const ANNOUNCEMENT_BUCKET = "public-assets"
export const ANNOUNCEMENT_IMAGE_TYPES = IMAGE_TYPES
export const ANNOUNCEMENT_IMAGE_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024 // the public-assets bucket limit

/** Storage path of an announcement image this module uploaded: announcements/<uuid>.<ext>. */
export const ANNOUNCEMENT_IMAGE_PATH = /^announcements\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/

/** The storage path inside a public URL of an announcement image, or null for any other URL. */
export function announcementImagePath(url: string | null | undefined) {
  const path = url?.split(`/object/public/${ANNOUNCEMENT_BUCKET}/`)[1]
  return path && ANNOUNCEMENT_IMAGE_PATH.test(path) ? path : null
}
