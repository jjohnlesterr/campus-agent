// Admin › Settings: the school's configuration (Campus Agent itself is the fixed product:
// its name and logo live in code and assets). Shared by server actions, pages and client
// forms (no server-only imports). Secrets (API keys, Supabase keys, model and prompt
// configuration) are environment configuration and never appear here.

import { IMAGE_TYPES } from "@/lib/sources"

export const RESPONSE_LANGUAGES = [
  { value: "auto", label: "Auto (match the question)" },
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
] as const
export type ResponseLanguage = (typeof RESPONSE_LANGUAGES)[number]["value"]

export function responseLanguage(value: unknown): ResponseLanguage {
  return value === "en" || value === "fil" ? value : "auto"
}

/** The school logo, in the public-assets bucket under branding/. */
export const BRANDING_BUCKET = "public-assets"
export const BRANDING_IMAGE_TYPES = IMAGE_TYPES
export const BRANDING_IMAGE_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
export const MAX_BRANDING_IMAGE_BYTES = 2 * 1024 * 1024 // checked on the server
/** Larger images are optimized in the browser first (lib/image-optimize.ts) to fit this. */
export const BRANDING_UPLOAD_TARGET_BYTES = 1024 * 1024
export const BRANDING_MAX_DIMENSION = 1024
/** The largest original file accepted for optimizing. */
export const MAX_BRANDING_SOURCE_BYTES = 25 * 1024 * 1024
export const BRANDING_IMAGE_PATH = /^branding\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/
export const BRANDING_IMAGES = {
  university_logo_url: "University logo",
} as const
export type BrandingImage = keyof typeof BRANDING_IMAGES

/** The storage path inside a public URL of a branding image, or null for any other URL. */
export function brandingImagePath(url: string | null | undefined) {
  const path = url?.split(`/object/public/${BRANDING_BUCKET}/`)[1]
  return path && BRANDING_IMAGE_PATH.test(path) ? path : null
}
