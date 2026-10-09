"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { DEPARTMENT_BUCKET, DEPARTMENT_IMAGE_PATH, DEPARTMENT_IMAGE_TYPES, MAX_COVER_BYTES, MAX_LOGO_BYTES, departmentImagePath } from "@/lib/department-images"
import { normalizeFacebookUrl } from "@/lib/social-links"
import { detectMimeType } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Admin › Departments: structured records (departments and their programs), not Knowledge
// Library sources — no extraction, embeddings or AI. Profiles are never changed here: a
// department or program a profile points to cannot be deleted.

type Client = Awaited<ReturnType<typeof createClient>>
export type DepartmentResult = { ok: true } | { ok: false; error: string }

const imagePath = z.string().regex(DEPARTMENT_IMAGE_PATH, "Invalid image upload.")
const departmentSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter the department name.").max(150, "Use 150 characters or fewer for the name."),
  shortName: z.string().trim().min(1, "Enter a short name, such as CECT.").max(20, "Use 20 characters or fewer for the short name."),
  description: z.string().trim().max(1000, "Keep the description under 1,000 characters."),
  // Optional official Facebook page: trimmed, checked and normalized (never fetched).
  facebookUrl: z.string().max(600, "This link is too long.").optional().transform((value, ctx) => {
    const link = normalizeFacebookUrl(value)
    if (!link.ok) {
      ctx.addIssue({ code: "custom", message: link.error })
      return z.NEVER
    }
    return link.url
  }),
  // undefined keeps the current image, null removes it, a path is a new upload.
  logoPath: imagePath.nullable().optional(),
  coverPath: imagePath.nullable().optional(),
  // Where the cover sits in its crop window (CSS object-position, %). The file is never changed.
  coverPosition: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).default({ x: 50, y: 50 }),
  programs: z.array(z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Enter a name for every program.").max(200, "Use 200 characters or fewer for program names."),
    code: z.string().trim().max(30, "Use 30 characters or fewer for program codes."),
  })).max(100, "A department can list up to 100 programs."),
})
export type DepartmentInput = z.input<typeof departmentSchema>

function revalidate() {
  revalidatePath("/admin/departments")
  revalidatePath("/admin/settings")
}

const publicUrl = (db: Client, path: string) => db.storage.from(DEPARTMENT_BUCKET).getPublicUrl(path).data.publicUrl

/** Removes only images this module uploaded (departments/<uuid>.<ext>). */
async function removeImages(db: Client, paths: (string | null | undefined)[]) {
  const own = paths.filter((p): p is string => !!p && DEPARTMENT_IMAGE_PATH.test(p))
  if (own.length) await db.storage.from(DEPARTMENT_BUCKET).remove(own)
}

/** The uploaded file must really be a PNG, JPG or WebP image within the size limit. */
async function verifyImage(db: Client, path: string, maxBytes: number, label: string) {
  const { data: file, error } = await db.storage.from(DEPARTMENT_BUCKET).download(path)
  if (error || !file) return `The ${label} could not be read. Please upload it again.`
  if (file.size > maxBytes) return `The ${label} must be ${maxBytes / 1024 / 1024} MB or smaller.`
  const type = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!type || !(DEPARTMENT_IMAGE_TYPES as readonly string[]).includes(type)) return `The ${label} must be a PNG, JPG or WebP image.`
  return null
}

/** Profiles that point to the department or to any of the given programs. */
async function profilesUsing(db: Client, departmentId: string | null, programIds: string[]) {
  const filters = [
    ...(departmentId ? [`department_id.eq.${departmentId}`, `intended_department_id.eq.${departmentId}`] : []),
    ...(programIds.length ? [`program_id.in.(${programIds.join(",")})`, `intended_program_id.in.(${programIds.join(",")})`] : []),
  ]
  if (!filters.length) return 0
  const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).or(filters.join(","))
  if (error) throw new Error(error.message)
  return count ?? 0
}

const duplicate = (message: string | undefined) =>
  message?.includes("departments_name_key") ? "Another department already uses this name."
  : message?.includes("departments_code_key") ? "Another department already uses this short name."
  : message?.includes("programs_code_key") ? "A program code is already used by another program."
  : null

/**
 * Creates or updates a department with its programs, in the order given. Images were
 * uploaded by the browser first; a new upload is verified here, and on any failure it is
 * removed while the department keeps its current images.
 */
export async function saveDepartment(input: DepartmentInput): Promise<DepartmentResult> {
  await requireAdmin()
  const db = await createClient()
  const uploads = [input.logoPath, input.coverPath].filter((p): p is string => typeof p === "string")
  const fail = async (error: string): Promise<DepartmentResult> => {
    await removeImages(db, uploads)
    return { ok: false, error }
  }

  const parsed = departmentSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the department fields.")
  const values = parsed.data
  // The code is optional: a blank code is saved as null, never derived from the name.
  const programs = values.programs.map((p) => ({ ...p, code: p.code || null }))
  const codes = programs.flatMap((p) => (p.code ? [p.code.toLowerCase()] : []))
  if (new Set(codes).size !== codes.length) return fail("Each program code must be different.")

  for (const [path, max, label] of [[values.logoPath, MAX_LOGO_BYTES, "logo"], [values.coverPath, MAX_COVER_BYTES, "cover image"]] as const) {
    if (!path) continue
    const problem = await verifyImage(db, path, max, label)
    if (problem) return fail(problem)
  }

  let current: { id: string; logo_url: string | null; cover_image_url: string | null } | null = null
  let existingPrograms: { id: string }[] = []
  if (values.id) {
    const { data, error } = await db.from("departments").select("id, logo_url, cover_image_url, programs(id)").eq("id", values.id).maybeSingle()
    if (error || !data) return fail("This department no longer exists. Refresh the page.")
    current = data
    existingPrograms = data.programs
  }
  const kept = new Set(programs.flatMap((p) => (p.id ? [p.id] : [])))
  if ([...kept].some((id) => !existingPrograms.some((p) => p.id === id))) return fail("The programs changed since you opened this department. Refresh the page and try again.")
  const removed = existingPrograms.filter((p) => !kept.has(p.id)).map((p) => p.id)
  try {
    const inUse = await profilesUsing(db, null, removed)
    if (inUse) return fail(`A removed program is chosen by ${inUse === 1 ? "1 account" : `${inUse} accounts`}, so it cannot be removed. Keep it, or change those accounts first.`)
  } catch {
    return fail("Program usage could not be checked. Please try again.")
  }

  const image = (path: string | null | undefined, url: string | null | undefined) => path === undefined ? url ?? null : path && publicUrl(db, path)
  const row = {
    name: values.name,
    code: values.shortName,
    description: values.description || null,
    facebook_url: values.facebookUrl,
    logo_url: image(values.logoPath, current?.logo_url),
    cover_image_url: image(values.coverPath, current?.cover_image_url),
    cover_position_x: Math.round(values.coverPosition.x * 100) / 100,
    cover_position_y: Math.round(values.coverPosition.y * 100) / 100,
  }

  let departmentId = values.id
  if (departmentId) {
    const { error } = await db.from("departments").update(row).eq("id", departmentId)
    if (error) return fail(duplicate(error.message) ?? "The department could not be saved. Please try again.")
  } else {
    // New departments go to the end of the gallery.
    const { data: last } = await db.from("departments").select("sort_order").order("sort_order", { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    const { data, error } = await db.from("departments").insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 }).select("id").single()
    if (error || !data) return fail(duplicate(error?.message) ?? "The department could not be created. Please try again.")
    departmentId = data.id
  }

  const partial = "The department was saved, but its programs were not all saved. Open it again to check them."
  if (removed.length) {
    const { error } = await db.from("programs").delete().in("id", removed)
    if (error) return { ok: false, error: partial }
  }
  for (const [index, program] of programs.entries()) {
    const fields = { name: program.name, code: program.code, sort_order: index + 1 }
    const { error } = program.id
      ? await db.from("programs").update(fields).eq("id", program.id).eq("department_id", departmentId)
      : await db.from("programs").insert({ ...fields, department_id: departmentId })
    if (error) {
      revalidate()
      return { ok: false, error: duplicate(error.message) ?? partial }
    }
  }

  // Replaced or removed images are deleted only once the department points elsewhere.
  if (current) {
    await removeImages(db, [
      values.logoPath !== undefined ? departmentImagePath(current.logo_url) : null,
      values.coverPath !== undefined ? departmentImagePath(current.cover_image_url) : null,
    ])
  }
  revalidate()
  return { ok: true }
}

/** Cleans up uploads that never reached saveDepartment (e.g. the request was interrupted). */
export async function discardDepartmentUploads(paths: string[]): Promise<void> {
  await requireAdmin()
  const own = paths.filter((p) => DEPARTMENT_IMAGE_PATH.test(p))
  if (!own.length) return
  const db = await createClient()
  const urls = own.map((p) => publicUrl(db, p))
  const { data: used } = await db.from("departments").select("logo_url, cover_image_url").or(urls.flatMap((u) => [`logo_url.eq."${u}"`, `cover_image_url.eq."${u}"`]).join(","))
  const inUse = new Set((used ?? []).flatMap((d) => [d.logo_url, d.cover_image_url]))
  await removeImages(db, own.filter((p, i) => !inUse.has(urls[i])))
}

export async function setDepartmentPublished(id: string, published: boolean): Promise<DepartmentResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid department." }
  const db = await createClient()
  const { data, error } = await db.from("departments").update({ is_published: published }).eq("id", id).select("id").maybeSingle()
  if (error || !data) return { ok: false, error: `The department could not be ${published ? "published" : "unpublished"}. Please try again.` }
  revalidate()
  return { ok: true }
}

/** Deletes a department and its programs, unless an account points to either. */
export async function deleteDepartment(id: string): Promise<DepartmentResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid department." }
  const db = await createClient()
  const { data: department, error } = await db.from("departments").select("id, logo_url, cover_image_url, programs(id)").eq("id", id).maybeSingle()
  if (error || !department) return { ok: false, error: "This department no longer exists. Refresh the page." }
  try {
    const inUse = await profilesUsing(db, id, department.programs.map((p) => p.id))
    if (inUse) return { ok: false, error: `${inUse === 1 ? "1 account uses" : `${inUse} accounts use`} this department or its programs, so it cannot be deleted. Unpublish it instead.` }
  } catch {
    return { ok: false, error: "Department usage could not be checked. Please try again." }
  }
  const { error: deleteError } = await db.from("departments").delete().eq("id", id)
  if (deleteError) return { ok: false, error: "The department could not be deleted. Please try again." }
  await removeImages(db, [departmentImagePath(department.logo_url), departmentImagePath(department.cover_image_url)])
  revalidate()
  return { ok: true }
}

const reorderSchema = z.array(z.uuid()).max(500)

export async function reorderDepartments(ids: string[]): Promise<DepartmentResult> {
  await requireAdmin()
  const parsed = reorderSchema.safeParse(ids)
  if (!parsed.success) return { ok: false, error: "Invalid department order." }
  const db = await createClient()
  const { data: departments, error } = await db.from("departments").select("id, sort_order")
  if (error || !departments) return { ok: false, error: "The departments could not be loaded. Refresh the page and try again." }
  const current = new Map(departments.map((d) => [d.id, d.sort_order]))
  if (new Set(parsed.data).size !== parsed.data.length || parsed.data.length !== current.size || parsed.data.some((d) => !current.has(d))) {
    return { ok: false, error: "The departments changed. Refresh the page and try again." }
  }
  for (const [index, departmentId] of parsed.data.entries()) {
    if (current.get(departmentId) === index + 1) continue
    const { error: updateError } = await db.from("departments").update({ sort_order: index + 1 }).eq("id", departmentId)
    if (updateError) return { ok: false, error: "The new order could not be saved. Refresh the page and try again." }
  }
  revalidate()
  return { ok: true }
}
