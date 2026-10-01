import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

/** Either the cookie-based server client (signed-in user) or the anonymous public client. */
export type DbClient = SupabaseClient<Database>
