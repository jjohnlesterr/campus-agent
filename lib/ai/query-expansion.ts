// Search-only query expansion. The handbook is written in English and uses full
// terms ("Transcript of Records", "incomplete"), so Tagalog/Taglish and short
// student wording ("kuha TOR", "magkano", "lipat") is expanded with the English
// words the handbook actually uses. Only the full-text search sees the expanded
// text — Claude still receives the student's original question.

import { normalize } from "@/lib/campus/location-match"

type Rule = { match: (token: string) => boolean; add: string }

const word = (...words: string[]) => (t: string) => words.includes(t)
const stem = (...stems: string[]) => (t: string) => stems.some((s) => t.includes(s))

const RULES: Rule[] = [
  // Documents
  { match: word("tor", "transcript"), add: "transcript records" },
  { match: word("coe"), add: "certificate enrollment" },
  { match: word("cor"), add: "certificate registration" },
  { match: word("diploma"), add: "diploma credentials" },
  { match: stem("certif", "sertipik"), add: "certification certificate" },
  { match: stem("kuha", "kumuha", "makakuha", "humingi", "hingi", "request", "magrequest"), add: "request document" },
  // Money
  { match: word("magkano", "presyo", "halaga", "bayad", "bayaran", "magbayad", "magbabayad", "fee", "fees", "much", "cost"), add: "fee fees payment" },
  { match: stem("tuition", "matrikula"), add: "tuition fees" },
  // Grades
  { match: word("inc", "incomplete"), add: "incomplete completion grade" },
  { match: word("grado", "marka", "grades", "grade"), add: "grade grades grading" },
  { match: word("bagsak", "bumagsak", "failed", "fail"), add: "failed failing grade" },
  { match: word("ayusin", "ayos", "tapusin", "complete"), add: "completion complete" },
  // Enrollment and records
  { match: stem("enrol", "magenroll", "nagenroll"), add: "enrollment registration enroll" },
  { match: word("lipat", "lumipat", "magtransfer", "transfer", "transferee"), add: "transfer transferring" },
  { match: stem("shift", "magshift"), add: "shifting shift course program change" },
  { match: word("drop", "idrop", "magdrop", "dropping"), add: "dropping withdrawal" },
  { match: word("loa"), add: "leave absence" },
  { match: stem("withdraw"), add: "withdrawal" },
  // Requirements and honors
  { match: word("req", "reqs", "requirement", "requirements", "kailangan", "rekisito", "kinakailangan"), add: "requirements required" },
  { match: word("laude", "latin", "parangal", "honor", "honors", "deans", "dean"), add: "honors graduation dean list" },
  { match: stem("gradwa", "graduat"), add: "graduation graduating" },
  { match: stem("clearan"), add: "clearance" },
  // Conduct
  { match: word("uniporme", "uniform", "damit", "suot", "isuot", "dress"), add: "dress code uniform attire" },
  { match: stem("violat", "paglabag", "parusa", "penalt"), add: "violations offenses sanctions" },
  { match: word("id"), add: "identification card id" },
  // Offices
  { match: word("opisina", "office"), add: "office" },
]

/** The question plus English handbook terms for any Tagalog/Taglish or shorthand words in it. */
export function expandQuery(question: string) {
  const tokens = normalize(question).split(" ").filter(Boolean)
  const extra = new Set<string>()
  for (const rule of RULES) if (tokens.some(rule.match)) for (const w of rule.add.split(" ")) extra.add(w)
  return extra.size ? `${question} ${[...extra].join(" ")}` : question
}
