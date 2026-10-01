import "server-only"

import type { StructuredAnswer } from "@/lib/ai/answer-types"
import type { ReplyLanguage } from "@/lib/ai/language"
import type { ProgramsQuestion } from "@/lib/campus/programs-match"
import type { DbClient } from "@/lib/supabase/types"

/**
 * "Bachelor of Science in Information Technology (BSIT)". Acronym codes are added; descriptive
 * codes ("BS Psychology") would only repeat the name, and abbreviation-only programs show as-is.
 */
function programLabel(p: { code: string; name: string }) {
  return p.code === p.name || p.name.includes(p.code) || /\s/.test(p.code) ? p.name : `${p.name} (${p.code})`
}

/** Colleges and their programs from the official records (Settings → Colleges and programs). */
export async function answerProgramsQuestion(question: ProgramsQuestion, language: ReplyLanguage, supabase: DbClient): Promise<StructuredAnswer> {
  let query = supabase.from("departments").select("code, name, programs(code, name)").order("code")
  if (question.department) query = query.eq("code", question.department)
  const { data, error } = await query
  if (error) throw new Error(`Programs could not be loaded: ${error.message}`)
  const colleges = data ?? []

  const none = language === "fil" ? "Wala pang nakalistang programa." : "Programs not yet listed."
  const details = colleges
    .map((c) => {
      const programs = [...c.programs].sort((a, b) => a.name.localeCompare(b.name)).map(programLabel)
      return `- **${c.name} (${c.code})**: ${programs.length ? programs.join("; ") : none}`
    })
    .join("\n")

  const scope = question.department ? colleges[0]?.name ?? question.department : null
  const summary = !colleges.length
    ? language === "fil" ? "Walang nakalistang kolehiyo o programa." : "No colleges or programs are listed yet."
    : language === "fil"
      ? scope ? `Ito ang mga programang nakalista para sa ${scope}:` : "Ito ang mga kolehiyo at programang nakalista sa unibersidad:"
      : scope ? `Here are the programs listed for the ${scope}:` : "Here are the colleges and programs listed for the university:"

  return {
    status: colleges.length ? "answered" : "not_found",
    summary,
    steps: [],
    requirements: [],
    details,
    gaps: "",
    sources: colleges.length ? [{ label: "University colleges and programs", documentTitle: "University colleges and programs", pageNumber: null, sectionTitle: null }] : [],
  }
}
