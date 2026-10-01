// "What programs are offered?" / "Anong mga programs meron?" — answered from the
// colleges and programs records, not handbook text. Pure detection.

import { normalize } from "@/lib/campus/location-match"

const SUBJECT = new Set(["program", "programs", "course", "courses", "kurso", "degree", "degrees", "college", "colleges", "kolehiyo"])
const ASKING = new Set(["offer", "offers", "offered", "offering", "available", "meron", "mayroon", "may", "list", "what", "which", "ano", "anong", "anu", "anung", "lahat", "all"])
// Wording that makes it a procedure question for the handbook instead ("requirements for BSIT", "shift course").
const PROCEDURE = /\b(?:requir\w*|shift\w*|magshift|transfer\w*|lipat|enrol\w*|fee|fees|tuition|magkano|how|paano|pano|where|saan|nasaan)\b/

export type ProgramsQuestion = { department: string | null }

export function detectProgramsQuestion(question: string, departmentCodes: string[]): ProgramsQuestion | null {
  const text = normalize(question)
  const tokens = text.split(" ").filter(Boolean)
  if (!tokens.some((t) => SUBJECT.has(t)) || PROCEDURE.test(text)) return null
  const codes = new Map(departmentCodes.map((c) => [c.toLowerCase(), c]))
  const department = tokens.map((t) => codes.get(t)).find(Boolean) ?? null
  // A list request ("what/anong/meron …"), or a short message naming a college ("CECT courses").
  if (!tokens.some((t) => ASKING.has(t)) && !(department && tokens.length <= 3)) return null
  return { department }
}
