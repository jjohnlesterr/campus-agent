// English vs Tagalog/Taglish, for the replies Campus Agent writes itself (not-found,
// announcements). Claude-written answers follow the question's language on
// their own. Any common Filipino function word marks the message as Tagalog/Taglish.

export type ReplyLanguage = "en" | "fil"

const FILIPINO_WORDS = new Set([
  "ano", "anong", "paano", "pano", "papaano", "saan", "san", "nasaan", "nasan", "asan", "kailan", "kelan", "magkano",
  "sino", "bakit", "ilan", "pwede", "puwede", "pede", "ba", "po", "opo", "ng", "nang", "yung", "ung", "mga", "ko",
  "mo", "ako", "ikaw", "sa", "ang", "para", "meron", "wala", "hindi", "di", "gusto", "kailangan", "kuha",
  "kumuha", "makakuha", "ayusin", "naman", "lang", "din", "rin", "ngayon", "ngayong", "linggo", "bukas", "dito",
  "doon", "yun", "iyon", "ito", "kung", "kasi", "pag", "kapag", "lipat", "lumipat", "ganap", "anunsyo",
])

export function detectLanguage(text: string): ReplyLanguage {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  return words.some((w) => FILIPINO_WORDS.has(w)) ? "fil" : "en"
}
