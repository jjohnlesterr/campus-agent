// Campus location questions: intent detection, deterministic matching against
// the official map legend, and the student-facing sentence. Pure functions —
// no database or AI — so answers can never name a building, number or floor
// that isn't in the records.

export type Language = "en" | "fil"

export type LocationQuestion = {
  language: Language
  /** Normalized words that name the place, e.g. ["registrar"]. */
  target: string[]
  /** Bare mentions ("registrar") only answer on an exact name/alias match. */
  exactOnly?: boolean
}

export type MapPlace = {
  name: string
  building_name: string | null
  building_number: number
  floor: string | null
  aliases: string[]
}

export type LocationMatch =
  | { kind: "found"; place: MapPlace }
  | { kind: "ambiguous"; places: MapPlace[] }
  | { kind: "none" }

/** Lowercase, "&" → "and", drop possessives and punctuation (WU-P → wup). */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]s\b/g, "")
    .replace(/(\w)[-'’.](?=\w)/g, "$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Clear location phrasing only. "Where do I submit…" is a procedure, not a place.
const ENGLISH_INTENT =
  /\bwhere(?: is| are|s| can i find| would i find| do i find| to find)\b|\bwhere\b.*\blocated\b|\bhow (?:do|can) i (?:find|get to|go to|locate)\b|\blocation of\b|\b(?:what|which) (?:floor|building)\b/
const FILIPINO_INTENT =
  /\b(?:nasaan|nasan|asan)\b|\b(?:saan|san) (?:ang|ba|po|yung|ung|makikita|matatagpuan|banda|located|nakalagay)\b/

// Words that carry intent or grammar, not the place's identity.
const STOPWORDS = new Set([
  // English
  "where", "is", "are", "s", "can", "would", "do", "does", "i", "we", "find", "to", "how", "get", "go", "locate",
  "located", "location", "what", "which", "floor", "building", "bldg", "the", "a", "an", "of", "and", "in", "on",
  "at", "office", "please", "pls", "campus", "here", "exactly", "situated",
  // Filipino / Taglish
  "nasaan", "nasan", "asan", "saan", "san", "ang", "ba", "po", "yung", "ung", "ng", "sa", "si", "mga", "makikita",
  "matatagpuan", "banda", "nakalagay", "dito", "yun", "kaya",
])

function keyTokens(text: string) {
  return normalize(text).split(" ").filter((t) => t && !STOPWORDS.has(t))
}

/** A location question and the place it names, or null for anything else. */
export function detectLocationQuestion(question: string): LocationQuestion | null {
  const text = normalize(question.replace(/\bwhere['’]s\b/gi, "where is"))
  const filipino = FILIPINO_INTENT.test(text)
  if (!filipino && !ENGLISH_INTENT.test(text)) return null
  const target = keyTokens(text)
  if (target.length === 0 || target.length > 8) return null
  return { language: filipino ? "fil" : "en", target }
}

/**
 * A short message that is just a place name ("registrar", "library", "cect").
 * Matched exactly only, so words like "inc" or "kuha tor" never become locations.
 */
export function detectPlaceMention(question: string, language: Language): LocationQuestion | null {
  const target = keyTokens(question)
  if (target.length === 0 || target.length > 3) return null
  return { language, target, exactOnly: true }
}

/**
 * Finds the place a question names. Exact name/alias first; otherwise the
 * entries whose name contains every word asked for; otherwise the most
 * specific entry whose name appears inside the question.
 * Ties are reported as ambiguous rather than guessed.
 */
export function matchPlace(
  target: string[],
  places: MapPlace[],
  departmentAliases: Map<string, string[]> = new Map(),
  { exactOnly = false }: { exactOnly?: boolean } = {}
): LocationMatch {
  // "Where is Building 1?" → the building with that number.
  if (target.length === 1 && /^\d+$/.test(target[0])) {
    const building = places.find((p) => isBuilding(p) && p.building_number === Number(target[0]))
    return building ? { kind: "found", place: building } : { kind: "none" }
  }

  const asked = new Set(target)
  const keysFor = (p: MapPlace) =>
    [p.name, ...p.aliases, ...(departmentAliases.get(normalize(p.name)) ?? [])].map((k) => new Set(keyTokens(k))).filter((k) => k.size > 0)

  let best: { score: number; places: MapPlace[] } = { score: Infinity, places: [] }
  const consider = (place: MapPlace, score: number) => {
    if (score < best.score) best = { score, places: [place] }
    else if (score === best.score && !best.places.includes(place)) best.places.push(place)
  }

  // 1. Every asked word is in the entry. An exact name/alias wins; partial
  //    matches rank equally, so "vice president" lists every VP office.
  for (const place of places) {
    for (const key of keysFor(place)) {
      if ([...asked].every((t) => key.has(t))) consider(place, key.size === asked.size ? 0 : 1)
    }
  }
  // 2. The entry's name sits inside a longer question ("accounting office ng wup").
  if (best.places.length === 0) {
    for (const place of places) {
      for (const key of keysFor(place)) {
        if ([...key].every((t) => asked.has(t))) consider(place, -key.size)
      }
    }
  }

  if (best.places.length === 0 || (exactOnly && best.score !== 0)) return { kind: "none" }
  if (best.places.length === 1) return { kind: "found", place: best.places[0] }
  return { kind: "ambiguous", places: best.places.slice(0, 5) }
}

export function isBuilding(place: MapPlace) {
  return place.name === place.building_name
}

function withArticle(building: string) {
  return /^dr\.\s/i.test(building) ? building : `the ${building}`
}

/** e.g. "L1 of the Gloria D. Lacson Building (Building 1)" — for lists. */
export function describePlace(place: MapPlace) {
  const building = `${place.building_name ?? place.name} (Building ${place.building_number})`
  if (isBuilding(place)) return `Building ${place.building_number}`
  return place.floor ? `${place.floor}, ${building}` : building
}

/** The one-sentence answer for a matched place. */
export function locationSentence(place: MapPlace, language: Language) {
  const n = place.building_number
  const building = place.building_name ?? place.name
  if (language === "fil") {
    if (isBuilding(place)) return `Ang ${place.name} ay Building ${n} sa campus map.`
    if (place.floor) return `Ang ${place.name} ay nasa ${place.floor} ng ${building} (Building ${n}).`
    return `Ang ${place.name} ay nasa ${building} (Building ${n}).`
  }
  if (isBuilding(place)) {
    const subject = withArticle(place.name)
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} is Building ${n} on the campus map.`
  }
  if (place.floor) return `${place.name} is located on ${place.floor} of ${withArticle(building)} (Building ${n}).`
  return `${place.name} is located in ${withArticle(building)} (Building ${n}).`
}

export function mapHint(buildingNumbers: number[], language: Language) {
  const label = buildingNumbers.length === 1 ? `Building ${buildingNumbers[0]}` : "these buildings"
  return language === "fil"
    ? `Makikita ang ${label} sa campus map.`
    : `You can use the campus map to locate ${label}.`
}

export function ambiguousIntro(target: string[], language: Language) {
  const asked = target.join(" ")
  return language === "fil"
    ? `May higit sa isang lugar na tumutugma sa “${asked}” sa campus map:`
    : `More than one place on the campus map matches “${asked}”:`
}

export function notFoundSentence(target: string[], language: Language) {
  const asked = target.join(" ")
  return language === "fil"
    ? `Hindi ko ma-verify ang eksaktong lokasyon ng “${asked}” mula sa opisyal na campus map.`
    : `I couldn't verify the exact location of “${asked}” from the official campus map.`
}
