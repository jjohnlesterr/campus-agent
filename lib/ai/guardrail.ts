// Pre-AI guardrail: answers obvious non-questions locally so they never reach
// Claude. Deterministic and deliberately permissive — any campus signal, or any
// doubt, sends the message on to the normal location / handbook / Claude flow.
// Pure module (no server or AI imports) so it can be unit-tested.

import { detectLocationQuestion, normalize } from "@/lib/campus/location-match"

export type GuardrailCategory = "greeting" | "help" | "nonsense" | "abusive" | "off_topic" | "campus" | "uncertain"

export type GuardrailResult =
  | { handledLocally: true; category: Exclude<GuardrailCategory, "campus" | "uncertain">; response: string }
  | { handledLocally: false; category: "campus" | "uncertain" }

export const LOCAL_RESPONSES = {
  greeting: "Hi! I can help with campus procedures, offices, events, announcements, and university information.",
  thanks: "You're welcome! Ask me anything about campus procedures, offices, events, or announcements.",
  help: "I can help with enrollment, grades, document requests, offices, campus locations, events, announcements, and other verified university information.",
  nonsense: "I'm here to help with university-related questions. Try asking about enrollment, grades, documents, offices, or campus services.",
  off_topic: "That's outside Campus Agent's scope. I can help with verified university information and campus processes.",
  abusive: "I'm here to help with campus-related questions. You can ask about school procedures, offices, events, or university information.",
} as const

// ---------- Campus signals (checked first; any match passes the message through) ----------

// Whole words only — short terms that would otherwise match inside other words ("inc" in "since").
const CAMPUS_WORDS = new Set([
  "inc", "tor", "id", "gpa", "units", "unit", "fee", "fees", "dean", "map", "sem", "loa", "ojt", "nstp", "rotc", "pe",
  "lab", "prof", "sched", "portal", "lms", "osa", "gym", "wup", "wesleyan", "honor", "honors", "form", "forms", "rules",
  "rule", "marka", "bayad", "klase", "kurso", "guro", "opisina",
  // Colleges
  "cas", "cams", "cba", "ccje", "cect", "chtm", "coed", "con",
])

// Word stems (matched inside words, so Taglish forms like "mag-enroll" / "magtransfer" count).
const CAMPUS_STEMS = [
  "enrol", "admission", "admit", "grade", "graduat", "gradwa", "clearan", "transfer", "lipat", "shift", "scholar",
  "transcript", "diploma", "registrar", "accounting", "cashier", "treasur", "tuition", "matrikula", "office", "depart",
  "college", "program", "course", "campus", "building", "event", "announce", "dress", "uniform", "handbook", "polic",
  "requir", "rekisito", "exam", "pagsusulit", "schedul", "subject", "semester", "summer", "absence", "violat", "penalt",
  "librar", "gymnas", "clinic", "guidance", "certific", "document", "request", "curricul", "professor", "faculty",
  "class", "student", "estudyante", "school", "eskwela", "paaralan", "univers", "unibersidad", "calendar", "deadline",
  "probation", "suspen", "dropping", "withdraw", "tutor", "dormitor", "chapel", "auditorium", "canteen",
]

function hasCampusSignal(text: string, tokens: string[]) {
  return (
    tokens.some((t) => CAMPUS_WORDS.has(t)) ||
    tokens.some((t) => CAMPUS_STEMS.some((s) => t.includes(s))) ||
    detectLocationQuestion(text) !== null // "Nasaan yung …?", "Where is …?"
  )
}

// ---------- Local categories (only when there is no campus signal) ----------

// Messages made only of these words are greetings / small talk.
const GREETING_WORDS = new Set([
  "hi", "hii", "hiii", "hello", "helo", "hey", "heya", "yo", "sup", "good", "morning", "afternoon", "evening", "day",
  "gm", "kumusta", "kamusta", "musta", "magandang", "umaga", "hapon", "gabi", "tanghali", "po", "poh", "there",
  "campus", "agent", "everyone", "ok", "okay", "oki", "sige", "noted", "ayos",
])
const THANKS_WORDS = new Set(["thanks", "thank", "thx", "ty", "tysm", "salamat"])
const THANKS_FILLER = new Set(["you", "so", "much", "very", "maraming", "a", "lot"])

/** Laughter, fillers and test strings: "haha", "hmm", "lol", "test". */
const FILLER = /^(?:(?:ha|he){2,}h?|h+m+|lol|lmao|xd|test|testing|asdf|qwerty|kk*|uh+m*|eh+m*)$/

const HELP_PATTERNS = [
  /^(?:help|tulong)(?: po| me| naman)?$/,
  /\bwhat (?:can|do) you (?:do|help with|know)\b/,
  /\bwhat (?:is|are) (?:this|you|campus agent)\b/,
  /\bwho are you\b/,
  /\bhow (?:does this|do you|do i use (?:this|you)) work\b/,
  /\bhow (?:do i|to) use (?:this|you|campus agent)\b/,
  /\bwhat (?:can|should) i ask\b/,
  /^ano(?: kaya| ba| po)?$/,
  /\bano (?:ang )?(?:kaya mo|pwede (?:ko )?(?:itanong|i ask)|magagawa mo|ginagawa mo)\b/,
  /\banong kaya mo(?:ng gawin)?\b/,
  /\bpaano (?:ka )?(?:gamitin|gumagana)\b/,
  /\bsino ka\b/,
]

// Insults/profanity. With no campus signal, a message containing these gets a neutral reply.
const ABUSIVE_WORDS = new Set([
  "fuck", "fucking", "fck", "fk", "shit", "stupid", "idiot", "dumb", "bitch", "asshole", "moron", "useless", "trash",
  "wtf", "stfu", "suck", "sucks", "gago", "gaga", "tanga", "bobo", "boba", "tangina", "putangina", "ulol", "inutil",
  "bwisit", "leche", "tarantado", "punyeta", "pakshet", "siraulo", "engot", "kupal", "pakyu", "tae",
])
const JOKE_PATTERNS = [/\bjokes?\b/, /\bknock knock\b/, /\bbiro\b/, /\bpatawa\b/, /\bpick ?up lines?\b/, /\bbanat\b/, /\bhugot\b/, /\bmake me laugh\b/]

// Clearly unrelated requests. Kept narrow on purpose.
const OFF_TOPIC_PATTERNS = [
  /\b(?:nba|pba|uaap|fifa|world cup|super bowl|premier league)\b/,
  /\bwho won\b/,
  /\b(?:weather|forecast)\b/,
  /\b(?:recipe|recipes|how to cook)\b/,
  /\b(?:movie|movies|netflix|kdrama|anime|lyrics)\b/,
  /\b(?:bitcoin|crypto|stocks?|forex|lotto)\b/,
  /\b(?:horoscope|zodiac)\b/,
  /\b(?:mobile legends|valorant|roblox|minecraft)\b/,
  /\bwrite (?:me )?(?:a )?(?:poem|song|story|essay)\b/,
  /\bcapital of\b/,
  /\b(?:girlfriend|boyfriend|crush|jowa)\b/,
]

/** Keyboard-mash words: long, few vowels or long consonant runs or one letter repeated. */
function looksLikeGibberish(token: string) {
  if (/\d/.test(token)) return false
  if (token.length >= 4 && !/[aeiouy]/.test(token)) return true // "hjkl", "sdfg"
  if (token.length < 5) return false
  const vowels = (token.match(/[aeiou]/g) ?? []).length
  return vowels / token.length < 0.2 || /[^aeiou\s]{5,}/.test(token) || /(.)\1{3,}/.test(token)
}

/**
 * Decides whether a message can be answered locally. Campus signals win over
 * everything; anything not clearly local is "uncertain" and goes to the normal flow.
 */
export function classifyMessage(message: string): GuardrailResult {
  const text = normalize(message)
  const tokens = text.split(" ").filter(Boolean)

  // The product's own name isn't a campus question ("hi Campus Agent", "what is Campus Agent?").
  const withoutName = text.replace(/\bcampus agent\b/g, " ").replace(/\s+/g, " ").trim()
  if (hasCampusSignal(withoutName, withoutName.split(" ").filter(Boolean))) return { handledLocally: false, category: "campus" }

  // No letters at all ("???", "....", "123"), every word keyboard mash, or only fillers ("haha", "hmm").
  if (tokens.length === 0 || !/[a-z]/.test(text) || tokens.every(looksLikeGibberish) || tokens.every((t) => FILLER.test(t))) {
    return { handledLocally: true, category: "nonsense", response: LOCAL_RESPONSES.nonsense }
  }
  if (tokens.some((t) => ABUSIVE_WORDS.has(t)) || JOKE_PATTERNS.some((p) => p.test(text))) {
    return { handledLocally: true, category: "abusive", response: LOCAL_RESPONSES.abusive }
  }
  if (tokens.some((t) => THANKS_WORDS.has(t)) && tokens.every((t) => THANKS_WORDS.has(t) || THANKS_FILLER.has(t) || GREETING_WORDS.has(t))) {
    return { handledLocally: true, category: "greeting", response: LOCAL_RESPONSES.thanks }
  }
  if (tokens.every((t) => GREETING_WORDS.has(t))) {
    return { handledLocally: true, category: "greeting", response: LOCAL_RESPONSES.greeting }
  }
  if (HELP_PATTERNS.some((p) => p.test(text))) {
    return { handledLocally: true, category: "help", response: LOCAL_RESPONSES.help }
  }
  if (OFF_TOPIC_PATTERNS.some((p) => p.test(text))) {
    return { handledLocally: true, category: "off_topic", response: LOCAL_RESPONSES.off_topic }
  }
  return { handledLocally: false, category: "uncertain" }
}
