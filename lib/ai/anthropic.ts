import "server-only"

import Anthropic from "@anthropic-ai/sdk"

// Claude model used by Campus Agent (docs/plan.md §27: Claude Sonnet 5).
export const CLAUDE_MODEL = "claude-sonnet-5"

let client: Anthropic | undefined

// Server-side Anthropic client. Reads ANTHROPIC_API_KEY from the server
// environment only — never import this from a Client Component.
export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error("Missing environment variable ANTHROPIC_API_KEY (server-only).")
    }
    client = new Anthropic({ apiKey })
  }
  return client
}
