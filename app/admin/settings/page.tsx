import { SchoolLogo, SettingsForm } from "@/components/admin/settings-forms"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { responseLanguage } from "@/lib/settings"
import { createClient } from "@/lib/supabase/server"

// Admin › Settings: the school using Campus Agent (name, short name, time zone, logo) and
// AI preferences. Campus Agent's own name and logo are the fixed product identity in code
// and assets, so they are not edited here. Content lives in its own modules; API keys,
// Supabase keys, models and prompts stay in server configuration.
export default async function AdminSettingsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: settings, error } = await supabase
    .from("system_settings")
    .select("university_name, university_short_name, timezone, university_logo_url, response_language, show_source_references")
    .maybeSingle()

  const timezones = Intl.supportedValuesOf("timeZone")
  const timezone = settings?.timezone ?? "Asia/Manila"

  return (
    <>
      <PageHeader title="Settings" description="Manage global Campus Agent configuration." />
      {error || !settings ? (
        <p role="alert" className="mt-6 text-sm text-destructive">Settings could not be loaded. Please refresh this page.</p>
      ) : (
        <SettingsForm
          timezones={timezones.includes(timezone) ? timezones : [timezone, ...timezones]}
          initial={{
            university_name: settings.university_name ?? "",
            university_short_name: settings.university_short_name ?? "",
            timezone,
            response_language: responseLanguage(settings.response_language),
            show_source_references: settings.show_source_references,
          }}
          logo={<SchoolLogo url={settings.university_logo_url} />}
        />
      )}
    </>
  )
}
