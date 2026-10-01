// Public Supabase config. Only NEXT_PUBLIC_* values belong here — they are
// inlined into the client bundle. Never add a secret / service-role key to
// this file; server-only secrets must live in a module that is never imported
// by client code.
//
// Next.js only inlines NEXT_PUBLIC_* vars when accessed as literal
// `process.env.NAME` expressions, so they are read explicitly below.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see Supabase dashboard → Project Settings → API).`
    )
  }
  return value
}

export function getSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      supabasePublishableKey
    ),
  }
}
