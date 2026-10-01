"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { zonedToUtcIso } from "@/lib/datetime"
import { type FormState, isoDate, optionalId, optionalUuid, toFieldErrors } from "@/lib/forms"
import { createClient } from "@/lib/supabase/server"

const eventSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(2, "Enter a title.").max(200),
  date: isoDate,
  time: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "Enter a valid time."),
  venue: z.string().trim().max(200),
  department_id: optionalUuid,
  description: z.string().trim().max(4000),
  status: z.enum(["draft", "published", "cancelled"]),
})

function revalidate() {
  revalidatePath("/admin/events")
  revalidatePath("/admin")
  revalidatePath("/app/events")
}

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = eventSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }

  const { id, date, time, ...input } = parsed.data
  const { timezone } = await getBranding()
  const row = {
    title: input.title,
    starts_at: zonedToUtcIso(date, time || "00:00", timezone),
    all_day: !time,
    venue: input.venue || null,
    department_id: input.department_id,
    description: input.description || null,
    status: input.status,
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from("events").update(row).eq("id", id)
    : await supabase.from("events").insert(row)
  if (error) return { error: "We couldn't save this event. Please try again." }

  revalidate()
  redirect("/admin/events")
}

export async function deleteEvent(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from("events").delete().eq("id", id)
  revalidate()
  redirect("/admin/events")
}
