import "server-only"

import { type ResponseLanguage, responseLanguage } from "@/lib/settings"
import { createClient } from "@/lib/supabase/server"
import type { DbClient } from "@/lib/supabase/types"

export type AiPreferences = { responseLanguage: ResponseLanguage; showSourceReferences: boolean }

const DEFAULTS: AiPreferences = { responseLanguage: "auto", showSourceReferences: true }

/** Admin › Settings › AI preferences (system_settings is readable by everyone). Defaults on any error. */
export async function getAiPreferences(client?: DbClient): Promise<AiPreferences> {
  try {
    const db = client ?? (await createClient())
    const { data } = await db.from("system_settings").select("response_language, show_source_references").maybeSingle()
    if (!data) return DEFAULTS
    return { responseLanguage: responseLanguage(data.response_language), showSourceReferences: data.show_source_references }
  } catch {
    return DEFAULTS
  }
}
