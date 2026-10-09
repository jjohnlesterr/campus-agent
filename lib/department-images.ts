// Admin › Departments: logo and cover images in the public-assets bucket under departments/.
// Shared by server actions and client components (no server-only imports).

import { IMAGE_TYPES } from "@/lib/sources"

export const DEPARTMENT_BUCKET = "public-assets"
export const DEPARTMENT_IMAGE_TYPES = IMAGE_TYPES
export const DEPARTMENT_IMAGE_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
export const MAX_LOGO_BYTES = 2 * 1024 * 1024
export const MAX_COVER_BYTES = 5 * 1024 * 1024 // the public-assets bucket limit

/** Storage path of a department image this module uploaded: departments/<uuid>.<ext>. */
export const DEPARTMENT_IMAGE_PATH = /^departments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/

/** The storage path inside a public URL of a department image, or null for any other URL. */
export function departmentImagePath(url: string | null | undefined) {
  const path = url?.split(`/object/public/${DEPARTMENT_BUCKET}/`)[1]
  return path && DEPARTMENT_IMAGE_PATH.test(path) ? path : null
}
