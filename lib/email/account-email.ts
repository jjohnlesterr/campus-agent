// "Your Campus Agent account" email for accounts an admin creates manually. Pure (no
// server imports) so it can be tested. The temporary password exists only in
// this message and in memory during the request — it is never stored or logged.

export type AccountEmailInput = {
  fullName: string
  email: string
  temporaryPassword: string
  loginUrl: string
  assistantName?: string
  /** Public https URL of the logo. Omitted in development: mail clients can't load localhost images. */
  logoUrl?: string
  /** "created" for a new account, "reset" when an admin sets a new temporary password. */
  reason?: "created" | "reset"
}

const NAVY = "#13204a"
const BLUE = "#1f6feb"
const SLATE = "#5b6b86"

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)

/** Logo image when a public URL exists; otherwise a text wordmark in the logo's colors. */
function brandHeader(assistantName: string, logoUrl?: string) {
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(assistantName)}" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0">`
  }
  const [first, ...rest] = assistantName.split(" ")
  const tail = rest.length ? ` <span style="color:${BLUE}">${escapeHtml(rest.join(" "))}</span>` : ""
  return `<span style="font-size:20px;font-weight:bold;letter-spacing:-0.01em;color:${NAVY}">${escapeHtml(first)}${tail}</span>`
}

export function buildAccountEmail({
  fullName,
  email,
  temporaryPassword,
  loginUrl,
  assistantName = "Campus Agent",
  logoUrl,
  reason = "created",
}: AccountEmailInput) {
  const subject = reason === "reset" ? `Your new ${assistantName} temporary password` : `Your ${assistantName} account`
  const intro =
    reason === "reset"
      ? `Your university administrator has set a new temporary password for your ${assistantName} account.`
      : `Your ${assistantName} account has been created by your university administrator.`
  const firstLogin = "You will be asked to create a new password the first time you sign in."
  const security = "For security, do not share your password with anyone."

  const text = [
    `Hello ${fullName},`,
    "",
    intro,
    "",
    "Email:",
    email,
    "",
    "Temporary password:",
    temporaryPassword,
    "",
    "Sign in:",
    loginUrl,
    "",
    firstLogin,
    "",
    security,
    "",
    assistantName,
  ].join("\n")

  const label = `margin:0;font-size:12px;color:${SLATE};text-transform:uppercase;letter-spacing:.04em`
  const value = `margin:4px 0 16px;font-size:15px;color:${NAVY}`
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f7fc;font-family:Arial,Helvetica,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dde4ef;border-radius:10px">
    <tr><td style="padding:24px 28px;border-bottom:1px solid #e6ebf3">${brandHeader(assistantName, logoUrl)}</td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 16px;font-size:15px">Hello ${escapeHtml(fullName)},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
      <p style="${label}">Email</p>
      <p style="${value}">${escapeHtml(email)}</p>
      <p style="${label}">Temporary password</p>
      <p style="${value};font-family:Consolas,Menlo,monospace;font-size:16px;letter-spacing:.03em">${escapeHtml(temporaryPassword)}</p>
      <p style="margin:8px 0 24px"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:bold">Sign in to ${escapeHtml(assistantName)}</a></p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${SLATE}">${escapeHtml(firstLogin)}</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${SLATE}">${escapeHtml(security)}</p>
      <p style="margin:0;font-size:14px;font-weight:bold;color:${NAVY}">${escapeHtml(assistantName)}</p>
    </td></tr>
  </table>
</body></html>`

  return { subject, text, html }
}
