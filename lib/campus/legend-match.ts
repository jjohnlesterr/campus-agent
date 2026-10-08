// Map legend questions: "What does CR mean on the map?", "Is there parking on campus?",
// "May comfort room ba?". Answers come only from the legend (code → label). The legend
// says what a symbol means, not where each one is, so answers point to the map instead
// of naming a spot. Pure functions — no database or AI.

import { type Language, normalize } from "@/lib/campus/location-match"

export type LegendEntry = { code: string; label: string; description: string | null }

// Everyday words for the same things, so "restroom" or "banyo" finds Comfort Room.
// Matched against the label; entries without a known synonym still match their label/code.
const SYNONYMS: Record<string, string[]> = {
  "comfort room": ["restroom", "toilet", "banyo", "cr", "washroom", "bathroom"],
  atm: ["atm", "bank machine"],
  gates: ["gate", "entrance", "exit", "gates"],
  security: ["security", "guard", "guards", "guard house"],
  "parking area": ["parking", "parking lot", "park my car", "parking space"],
  "assembly area": ["assembly area", "evacuation area", "assembly point"],
  "health service": ["health service", "first aid", "health services"],
  "canteen food court": ["canteen", "food court", "cafeteria", "kainan"],
  "crisis management command center": ["crisis management", "command center", "cmc"],
}

const MEANING = /\b(?:mean|means|meaning|stand for|stands for|symbol|ibig sabihin|kahulugan)\b/
const EXISTS_EN = /\b(?:is there|are there|is there an?|do you have|does the campus have|any)\b/
const EXISTS_FIL = /\b(?:may|meron|mayroon|meron bang|may ba)\b/
const WHERE = /\b(?:where|nasaan|nasan|asan|saan)\b/

export type LegendQuestion = { entry: LegendEntry; language: Language; kind: "meaning" | "available" }

/**
 * Words that name an entry. The bare symbol code only counts when the question asks
 * what a symbol means ("What does P mean?"): codes like A, S, G or P are also ordinary
 * words, so "Is there a gym?" must not become an ATM question. Everyday codes people
 * actually say ("CR", "ATM", "CMC") are listed as synonyms instead.
 */
function termsFor(entry: LegendEntry, meaning: boolean) {
  const label = normalize(entry.label)
  return [label, ...(SYNONYMS[label] ?? []), ...(meaning ? [normalize(entry.code)] : [])].filter((t) => t.length > 0)
}

/**
 * A short question about a legend symbol. Long or procedural questions ("What are the
 * parking rules for visitors?") are left to the handbook.
 */
export function detectLegendQuestion(question: string, legend: LegendEntry[]): LegendQuestion | null {
  const text = normalize(question)
  const words = text.split(" ")
  if (words.length > 10) return null
  const meaning = MEANING.test(text)
  const filipino = EXISTS_FIL.test(text) || /\b(?:ba|po|ang|ng)\b/.test(text)
  const asks = meaning || EXISTS_EN.test(text) || EXISTS_FIL.test(text) || WHERE.test(text)
  if (!asks) return null
  const padded = ` ${text} `
  // Longest matching term wins ("food court" over "court"); a plural also matches ("restrooms").
  let best: { entry: LegendEntry; length: number } | null = null
  for (const entry of legend) {
    for (const term of termsFor(entry, meaning)) {
      const found = padded.includes(` ${term} `) || padded.includes(` ${term}s `)
      if (found && (!best || term.length > best.length)) best = { entry, length: term.length }
    }
  }
  if (!best) return null
  return { entry: best.entry, language: filipino && !/\b(?:what|is there|are there|does)\b/.test(text) ? "fil" : "en", kind: meaning ? "meaning" : "available" }
}

/** The answer: what the symbol means / that it is marked on the map. Never an exact spot. */
export function legendSentence({ entry, language, kind }: LegendQuestion, mapAvailable: boolean) {
  const code = entry.code
  if (language === "fil") {
    if (kind === "meaning") return `Sa Campus Map, ang “${code}” ay ${entry.label}.`
    return `Oo. Ang ${entry.label} ay may markang “${code}” sa Campus Map.${mapAvailable ? " Tingnan ang mapa para makita kung saan ito banda." : ""}`
  }
  if (kind === "meaning") return `On the Campus Map, “${code}” means ${entry.label}.`
  return `Yes. The Campus Map marks ${entry.label} with the “${code}” symbol.${mapAvailable ? " Check the map to see where they are." : ""}`
}

/** Said with every legend answer: the directory records what symbols mean, not their exact positions. */
export function legendNote(language: Language) {
  return language === "fil"
    ? "Hindi nakatala sa campus directory ang eksaktong lokasyon ng bawat simbolo, kaya sundan ang mapa."
    : "The campus directory doesn't record the exact position of each symbol, so please use the map for the spot nearest you."
}
