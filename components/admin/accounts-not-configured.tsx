// Shown on Admin → Users forms when the server can't reach Supabase Auth's admin API.
export function AccountsNotConfigured() {
  return (
    <p role="alert" className="mt-6 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      Account management is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment, then restart the app.
    </p>
  )
}
