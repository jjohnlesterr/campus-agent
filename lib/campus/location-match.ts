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
  /** Correct small typos against legend words first ("registar" → "registrar"). */
  fuzzy?: boolean
}

export type MapPlace = {
  name: string
  /** The building's name, or "Hall (Wing), Building" for places inside a wing. */
  building_name: string | null
  building_number: number
  floor: string | null
  aliases: string[]
  /** building = the building itself; area = a wing/hall; place = something inside. */
  kind?: "building" | "area" | "place"
  /** Wing/hall the place is in, e.g. "Dr. Jorge Bocobo Hall (Left Wing)". */
  area?: string | null
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
/** Edit distance between two short words. */
function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

/**
 * Replaces misspelled words with the closest word used in the legend: within 1 edit,
 * or 2 for words of 7+ letters. Ties are left alone rather than guessed.
 */
export function correctTypos(target: string[], vocabulary: Set<string>) {
  return target.map((word) => {
    if (vocabulary.has(word) || word.length < 4 || /\d/.test(word)) return word
    const limit = word.length >= 7 ? 2 : 1
    let best: string | null = null
    let bestDistance = Infinity
    let tie = false
    for (const candidate of vocabulary) {
      if (Math.abs(candidate.length - word.length) > limit) continue
      const d = editDistance(word, candidate)
      if (d < bestDistance) [best, bestDistance, tie] = [candidate, d, false]
      else if (d === bestDistance) tie = true
    }
    return best && bestDistance <= limit && !tie ? best : word
  })
}

export function matchPlace(
  target: string[],
  places: MapPlace[],
  departmentAliases: Map<string, string[]> = new Map(),
  { exactOnly = false, fuzzy = false }: { exactOnly?: boolean; fuzzy?: boolean } = {}
): LocationMatch {
  if (fuzzy) {
    const vocabulary = new Set(
      places.flatMap((p) => [p.name, ...p.aliases, ...(departmentAliases.get(normalize(p.name)) ?? [])].flatMap(keyTokens))
    )
    target = correctTypos(target, vocabulary)
  }
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
  return place.kind ? place.kind === "building" : place.name === place.building_name
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

// "What is in Building 20?", "What offices are inside Gloria D. Lacson Building?",
// "Ano ang nasa Building 1?" — asks for a building's contents, not its location.
const CONTENTS_EN =
  /\b(?:what|which)\b(?: \w+){0,3} (?:is|are) (?:in|inside|located in|found in|at)\b|\bwhat(?:s| is| are)? (?:in|inside)\b|\b(?:offices|colleges|rooms) (?:in|inside)\b/
const CONTENTS_FIL = /\b(?:ano|anong|anu)\b.*\b(?:nasa|sa loob ng|laman ng|meron sa)\b/
const CONTENTS_STOPWORDS = new Set(["offices", "colleges", "rooms", "inside", "found", "there", "laman", "loob", "meron", "ano", "anong", "anu", "nasa", "areas", "places"])

/** A question about what a building contains, and the words naming the building. */
export function detectBuildingContentsQuestion(question: string): LocationQuestion | null {
  const text = normalize(question)
  const filipino = CONTENTS_FIL.test(text)
  if (!filipino && !CONTENTS_EN.test(text)) return null
  // "building" is a stopword for place names; keep "Building 20" as the number.
  const target = keyTokens(text).filter((t) => !CONTENTS_STOPWORDS.has(t))
  if (target.length === 0 || target.length > 8) return null
  return { language: filipino ? "fil" : "en", target }
}

/** The places inside a building, grouped by wing/hall and floor, as markdown lines. */
export function buildingContents(building: MapPlace, places: MapPlace[]) {
  const inside = places.filter((p) => p.building_number === building.building_number && !isBuilding(p) && p.kind !== "area")
  const groups = new Map<string, string[]>()
  for (const place of inside) {
    const label = [place.area, place.floor].filter(Boolean).join(" · ")
    groups.set(label, [...(groups.get(label) ?? []), place.name])
  }
  // Hall, then floor (L1, L2 …); places with no floor recorded come last.
  return [...groups]
    .sort(([a], [b]) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0) || a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, names]) => (label ? `- **${label}:** ${names.join(", ")}` : `- ${names.join(", ")}`))
}

/** The one-sentence lead for a building-contents answer. */
export function contentsSentence(building: MapPlace, count: number, language: Language) {
  const n = building.building_number
  if (language === "fil") {
    return count ? `Narito ang nasa ${building.name} (Building ${n}) ayon sa campus map:` : `Walang nakalistang opisina sa loob ng ${building.name} (Building ${n}) sa campus map.`
  }
  const subject = withArticle(building.name)
  return count ? `According to the campus map, ${subject} (Building ${n}) has:` : `The campus map doesn't list any offices inside ${subject} (Building ${n}).`
}
