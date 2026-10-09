// Account emails sent by the app (server-side, through lib/email/send.ts). Pure (no server
// imports) so they can be tested. Invitations use Supabase Auth's own email instead, and no
// email ever contains a password.

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

export type PasswordResetEmailInput = {
  fullName: string
  /** One-time Supabase recovery link (opens "Choose a new password"). Never logged. */
  resetUrl: string
  assistantName?: string
  logoUrl?: string
}

/** "Reset your password" email sent when an admin starts a password reset for a user. */
export function buildPasswordResetEmail({ fullName, resetUrl, assistantName = "Campus Agent", logoUrl }: PasswordResetEmailInput) {
  const subject = `Reset your ${assistantName} password`
  const intro = `A password reset was requested for your ${assistantName} account. Use the button below to choose a new password.`
  const note = "This link can be used once and expires soon. If you didn't expect this email, you can ignore it: your password stays the same."

  const text = [`Hello ${fullName},`, "", intro, "", "Choose a new password:", resetUrl, "", note, "", assistantName].join("\n")

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f7fc;font-family:Arial,Helvetica,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dde4ef;border-radius:10px">
    <tr><td style="padding:24px 28px;border-bottom:1px solid #e6ebf3">${brandHeader(assistantName, logoUrl)}</td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 16px;font-size:15px">Hello ${escapeHtml(fullName)},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:bold">Choose a new password</a></p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${SLATE}">${escapeHtml(note)}</p>
      <p style="margin:0;font-size:14px;font-weight:bold;color:${NAVY}">${escapeHtml(assistantName)}</p>
    </td></tr>
  </table>
</body></html>`

  return { subject, text, html }
}
