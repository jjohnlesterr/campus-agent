"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { zonedToUtcIso } from "@/lib/datetime"
import { type FormState, isoDate, optionalId, optionalUuid, toFieldErrors } from "@/lib/forms"
import { createClient } from "@/lib/supabase/server"

const announcementSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(2, "Enter a title.").max(200),
  content: z.string().trim().min(1, "Write the announcement.").max(8000),
  date: isoDate,
  department_id: optionalUuid,
  status: z.enum(["draft", "published", "archived"]),
})

function revalidate() {
  revalidatePath("/admin/announcements")
  revalidatePath("/admin")
  revalidatePath("/app/announcements")
}

export async function saveAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }

  const { id, date, ...input } = parsed.data
  const { timezone } = await getBranding()
  const row = { ...input, publish_at: zonedToUtcIso(date, "00:00", timezone) }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert(row)
  if (error) return { error: "We couldn't save this announcement. Please try again." }

  revalidate()
  redirect("/admin/announcements")
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from("announcements").delete().eq("id", id)
  revalidate()
  redirect("/admin/announcements")
}
