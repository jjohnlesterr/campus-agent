import "server-only"

import { Resend } from "resend"

// Transactional email through Resend (server-only).
//   RESEND_API_KEY     — API key from resend.com/api-keys
//   RESEND_FROM_EMAIL  — a sender on a domain verified in Resend, e.g. "Campus Agent <no-reply@your-school.edu>"
// Never NEXT_PUBLIC_: these stay on the server. Message bodies are never logged.

export type SendFailure = "not_configured" | "domain_not_verified" | "failed"
export type SendResult = { ok: true } | { ok: false; reason: SendFailure }

let client: Resend | undefined

export async function sendEmail(message: { to: string; subject: string; text: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return { ok: false, reason: "not_configured" }

  try {
    client ??= new Resend(apiKey)
    const { error } = await client.emails.send({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html })
    if (!error) return { ok: true }

    // Error name and status only — the message body contains the temporary password.
    console.error(`sendEmail: Resend rejected the message (${error.statusCode ?? "?"} ${error.name})`)
    if (error.name === "missing_api_key" || error.name === "invalid_api_key" || error.name === "restricted_api_key" || error.name === "invalid_from_address") {
      return { ok: false, reason: "not_configured" }
    }
    // Without a verified domain, Resend only delivers to the account owner's address.
    if (error.statusCode === 403 && /verify a domain|testing emails|not verified/i.test(error.message)) {
      return { ok: false, reason: "domain_not_verified" }
    }
    return { ok: false, reason: "failed" }
  } catch (error) {
    console.error("sendEmail: request failed", error instanceof Error ? error.name : "unknown")
    return { ok: false, reason: "failed" }
  }
}
