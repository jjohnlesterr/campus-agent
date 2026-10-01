import { z } from "zod"

export type FormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined

/** First message per field, keyed by field name. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    out[key] ??= issue.message
  }
  return out
}

/** "" → null, otherwise must be a UUID (select fields where empty means "none"). */
export const optionalUuid = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.uuid().nullable())

/** Optional hidden id field for create/edit forms. */
export const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined)
  .pipe(z.uuid().optional())

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
