// Admin → Knowledge Library sources: source types, accepted files and display labels.
// Shared by server actions and client components (no server-only imports).

import type { Enums } from "@/lib/supabase/database.types"

export type SourceType = Enums<"document_type">

export const PDF = "application/pdf"
/** Text sources: verified text written or pasted in the app, stored as a plain-text file. */
export const TEXT = "text/plain"
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024
export const MAX_TEXT_SOURCE_CHARS = 200_000

export type SourceFormat = "pdf" | "text" | "image"

/** Document source (uploaded PDF or image) or text source, from its stored MIME type. */
export function sourceFormat(mimeType: string): SourceFormat {
  return mimeType === PDF ? "pdf" : mimeType === TEXT ? "text" : "image"
}

/** PDFs and text sources are analyzed into knowledge sections; images are reference files. */
export function isAnalyzable(mimeType: string) {
  return sourceFormat(mimeType) !== "image"
}

/** Types an admin can choose when uploading. The campus map is managed in Admin › Campus Map instead. */
export const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string; hint: string }[] = [
  { value: "handbook", label: "Student Handbook", hint: "After upload, analyze it with AI to create knowledge sections for review." },
  { value: "policy", label: "Policy / Memo", hint: "After upload, analyze it with AI to create knowledge sections for review." },
  { value: "announcement", label: "Announcement Reference", hint: "After upload, analyze it with AI to create knowledge sections for review." },
  { value: "calendar", label: "Academic Calendar", hint: "After upload, analyze it with AI to create knowledge sections for review." },
  { value: "other", label: "Other", hint: "After upload, analyze it with AI to create knowledge sections for review." },
]

/** Source types a Knowledge Library upload can have (not the campus map). */
export const UPLOAD_SOURCE_TYPES = ["handbook", "policy", "announcement", "calendar", "other"] as const
export type UploadSourceType = (typeof UPLOAD_SOURCE_TYPES)[number]

// Collection names that clearly imply one source type, checked in order.
const COLLECTION_SOURCE_TYPES: [RegExp, UploadSourceType][] = [
  [/handbook/, "handbook"],
  [/calendar/, "calendar"],
  [/polic|memo/, "policy"],
  [/announcement/, "announcement"],
]

/**
 * The source type implied by a collection's name ("Student Handbook" → handbook), or
 * null when the name gives no clear type and the admin chooses one when uploading.
 */
export function collectionSourceType(collectionName: string | null | undefined): UploadSourceType | null {
  const name = collectionName?.toLowerCase() ?? ""
  return COLLECTION_SOURCE_TYPES.find(([pattern]) => pattern.test(name))?.[1] ?? null
}

const LABELS: Record<SourceType, string> = {
  handbook: "Student Handbook",
  policy: "Policy / Memo",
  memo: "Policy / Memo",
  announcement: "Announcement Reference",
  calendar: "Academic Calendar",
  campus_map: "Campus Map",
  guideline: "Guideline",
  form: "Form",
  other: "Other",
}

export function sourceTypeLabel(type: SourceType) {
  return LABELS[type] ?? "Other"
}

/** Images are reference files; PDFs with selectable text use the extraction pipeline. */
export function isReferenceOnly(type: SourceType, mimeType?: string) {
  return mimeType ? mimeType.startsWith("image/") : type === "campus_map"
}

/** MIME types a new Knowledge Library upload can have: PDF only. Campus map images use Admin › Campus Map. */
export function acceptedMimeTypes(): string[] {
  return [PDF]
}

export const EXTENSIONS: Record<string, string> = {
  [PDF]: "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/** Detects the real file type from its first bytes (never trust the extension). */
export function detectMimeType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (bytes.length >= 5 && ascii(0, 5) === "%PDF-") return PDF
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png"
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  return null
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
