// End-to-end knowledge lifecycle on an isolated Postgres (PGlite, all migrations applied):
// create → publish → ask → edit → ask → unpublish → ask → delete → ask.
// Real code: answerQuestion routing, lib/rag/search.ts and search_knowledge under the anon
// role's RLS. Admin steps are the same table writes the admin actions make. Claude is a
// deterministic stand-in that only cites sources sharing words with the question and quotes
// them, so citations and stale text can be checked exactly. Nothing connects to Supabase.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { asRole, migratedDb } from './support/migrated-db.mjs'

const nodeRequire = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
function load(relative, mocks = {}) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => (id in mocks ? mocks[id] : nodeRequire(id)), loaded, loaded.exports)
  return loaded.exports
}

let db
const claudeCalls = []

/** supabase-js stand-in for the public client: search_knowledge as the anon role, like PostgREST. */
const publicClient = {
  rpc: async (name, args) => {
    assert.equal(name, 'search_knowledge')
    const rows = await asRole(db, 'anon', async () => (await db.query('select * from public.search_knowledge($1, $2)', [args.query_text, args.match_count])).rows)
    return { data: rows, error: null }
  },
}

/** Grounded stand-in for Claude: cites sources that share a 4+ letter word with the question, quoting them. */
function fakeClaude(request) {
  claudeCalls.push(request)
  const prompt = request.messages[0].content
  const question = prompt.match(/<question>\n([\s\S]*?)\n<\/question>/)[1].toLowerCase()
  const words = new Set(question.match(/[a-z]{4,}/g))
  const sources = [...prompt.matchAll(/<source id="(\d+)"[^>]*>\n([\s\S]*?)\n<\/source>/g)].map(([, id, text]) => ({ id: Number(id), text }))
  const cited = sources.filter((s) => (s.text.toLowerCase().match(/[a-z]{4,}/g) ?? []).some((w) => words.has(w)))
  const parsed = cited.length
    ? { coverage: 'full', summary: cited.map((s) => s.text).join(' '), steps: [], requirements: [], details: '', gaps: '', source_ids: cited.map((s) => s.id) }
    : { coverage: 'none', summary: '', steps: [], requirements: [], details: '', gaps: 'Not covered.', source_ids: [] }
  return { stop_reason: 'end_turn', parsed_output: parsed, usage: { input_tokens: 1, output_tokens: 1 } }
}

const locationMatch = load('lib/campus/location-match.ts')
const withLocation = { '@/lib/campus/location-match': locationMatch }
const search = load('lib/rag/search.ts', {
  'server-only': {},
  '@/lib/knowledge/topics': load('lib/knowledge/topics.ts', { '@/lib/knowledge/tables': load('lib/knowledge/tables.ts'), '@/lib/rag/extract': {} }),
  '@/lib/supabase/server': { createClient: async () => { throw new Error('public answers never use the session client') } },
  '@/lib/supabase/types': {},
})
const agent = load('lib/ai/campus-agent.ts', {
  'server-only': {},
  '@/lib/ai/answer-types': load('lib/ai/answer-types.ts'),
  '@/lib/ai/anthropic': { CLAUDE_MODEL: 'test-model', getAnthropic: () => ({ messages: { parse: async (request) => fakeClaude(request) } }) },
  '@/lib/ai/guardrail': load('lib/ai/guardrail.ts', withLocation),
  '@/lib/ai/language': load('lib/ai/language.ts', withLocation),
  '@/lib/ai/preferences': { getAiPreferences: async () => ({ responseLanguage: 'auto', showSourceReferences: true }) },
  '@/lib/announcement-scopes': load('lib/announcement-scopes.ts'),
  '@/lib/ai/public-scope': load('lib/ai/public-scope.ts', withLocation),
  '@/lib/ai/query-expansion': load('lib/ai/query-expansion.ts', withLocation),
  '@/lib/campus/announcement-match': load('lib/campus/announcement-match.ts', withLocation),
  '@/lib/campus/announcements': { announcementPassages: async () => [], answerAnnouncementQuestion: async () => null },
  '@/lib/campus/location-match': locationMatch,
  '@/lib/campus/locations': { locationNotFound: async () => null, lookupBuildingContents: async () => null, lookupLegend: async () => null, lookupLocation: async () => null },
  '@/lib/campus/programs': { answerProgramsQuestion: async () => null, getDepartmentCodes: async () => [] },
  '@/lib/campus/programs-match': load('lib/campus/programs-match.ts', withLocation),
  '@/lib/supabase/public': { createPublicClient: () => publicClient },
  '@/lib/supabase/server': { createClient: async () => publicClient },
  '@/lib/supabase/types': {},
  '@/lib/rag/search': search,
})
const ask = (question) => agent.answerQuestion(question, { audience: 'public' })

const SOURCE = '00000000-0000-4000-8000-00000000a001'
const INGREDIENTS = '00000000-0000-4000-8000-00000000b001'
const STEPS = '00000000-0000-4000-8000-00000000b002'
// Unrelated published knowledge that must never be cited for adobo questions.
const OTHER_SOURCE = '00000000-0000-4000-8000-00000000a002'

before(async () => {
  db = await migratedDb()
  const { rows } = await db.query('select id from public.guideline_categories order by sort_order limit 1')
  const category = rows[0].id
  await db.query("insert into public.documents (id, title, status, visibility, mime_type, file_path, file_name, file_size) values ($1, 'Student Handbook', 'ready', 'public', 'application/pdf', 'h.pdf', 'h.pdf', 10)", [OTHER_SOURCE])
  await db.query("insert into public.guidelines (id, title, slug, content, source_document_id, status, visibility, category_id) values (gen_random_uuid(), 'Anti-Bullying Act', 'bullying', 'Bullying is any severe or repeated expression directed at another student.', $1, 'published', 'public', $2)", [OTHER_SOURCE, category])
  // 1. Create: a text source saved and organized into Draft sections (what Organize with AI writes).
  await db.query("insert into public.documents (id, title, status, visibility, mime_type, file_path, file_name, file_size) values ($1, 'Adobong Manok Recipe', 'ready', 'public', 'text/plain', 'adobo.txt', 'adobo.txt', 10)", [SOURCE])
  await db.query("insert into public.guidelines (id, title, slug, content, source_document_id, status, visibility, category_id) values ($1, 'Ingredients', 'adobo-ingredients', 'Adobong manok uses chicken, soy sauce, vinegar, garlic, pepper, and bay leaves.', $3, 'draft', 'public', $4), ($2, 'Steps', 'adobo-steps', 'Marinate the chicken, then simmer it in the sauce for forty minutes.', $3, 'draft', 'public', $4)", [INGREDIENTS, STEPS, SOURCE, category])
})
after(async () => { await db?.close() })

const labels = (answer) => answer.sources.map((s) => s.label)

test('lifecycle: a Draft source is never used', async () => {
  const answer = await ask('What ingredients are needed for adobong manok?')
  assert.equal(answer.status, 'not_found')
  assert.deepEqual(labels(answer), [])
  assert.ok(!answer.text.includes('soy sauce'))
})

test('lifecycle: once published it is retrieved, answered from and cited by its title', async () => {
  await db.query("update public.guidelines set status = 'published' where source_document_id = $1", [SOURCE])
  const answer = await ask('What ingredients are needed for adobong manok?')
  assert.equal(answer.status, 'answered')
  assert.match(answer.summary, /soy sauce, vinegar, garlic, pepper, and bay leaves/)
  assert.deepEqual(labels(answer), ['Adobong Manok Recipe'])
  // Only relevant sources are cited: the handbook section retrieved alongside is not.
  assert.ok(!labels(answer).includes('Student Handbook'))
  // Found by the source title alone ("adobong manok" is not in the Steps section's text).
  assert.ok(answer.retrieved.some((p) => p.sectionId === STEPS))
})

test('lifecycle: a question naming the source title also reaches it past the off-topic guardrail', async () => {
  const answer = await ask('How to cook adobong manok?')
  assert.equal(answer.handledLocally, undefined)
  assert.deepEqual(labels(answer), ['Adobong Manok Recipe'])
  // Both sections reach Claude, including Steps, whose text never says "adobong manok".
  assert.ok(answer.retrieved.some((p) => p.sectionId === STEPS))
  assert.ok(answer.retrieved.some((p) => p.sectionId === INGREDIENTS))
})

test('lifecycle: after an edit, answers use the new text and never the old', async () => {
  await db.query("update public.guidelines set content = 'Adobong manok uses chicken, soy sauce, cane vinegar, garlic, peppercorns, bay leaves, and potatoes.' where id = $1", [INGREDIENTS])
  const answer = await ask('What ingredients are needed for adobong manok?')
  assert.match(answer.summary, /potatoes/)
  assert.ok(!answer.summary.includes('pepper, and bay leaves'))
  assert.deepEqual(labels(answer), ['Adobong Manok Recipe'])
})

test('lifecycle: renaming the source updates the citation immediately', async () => {
  await db.query("update public.documents set title = 'Adobong Manok (Canteen Recipe)' where id = $1", [SOURCE])
  const answer = await ask('What ingredients are needed for adobong manok?')
  assert.deepEqual(labels(answer), ['Adobong Manok (Canteen Recipe)'])
})

test('lifecycle: after unpublishing, it is no longer retrieved or cited', async () => {
  await db.query("update public.guidelines set status = 'draft' where source_document_id = $1", [SOURCE])
  const answer = await ask('What ingredients are needed for adobong manok?')
  assert.equal(answer.status, 'not_found')
  assert.deepEqual(labels(answer), [])
  assert.ok(!answer.retrieved.some((p) => p.sectionId === INGREDIENTS || p.sectionId === STEPS))
})

test('lifecycle: archiving a published source removes it from answers', async () => {
  await db.query("update public.guidelines set status = 'published' where source_document_id = $1", [SOURCE])
  assert.equal((await ask('What ingredients are needed for adobong manok?')).status, 'answered')
  // archiveDocument: sections archived, then the source.
  await db.query("update public.guidelines set status = 'archived' where source_document_id = $1", [SOURCE])
  await db.query("update public.documents set status = 'archived' where id = $1", [SOURCE])
  assert.equal((await ask('What ingredients are needed for adobong manok?')).status, 'not_found')
})

test('lifecycle: after deletion nothing stale remains searchable', async () => {
  // deleteDocument: non-published sections, then the source.
  await db.query("delete from public.guidelines where source_document_id = $1 and status <> 'published'", [SOURCE])
  await db.query('delete from public.documents where id = $1', [SOURCE])
  const answer = await ask('What ingredients are needed for adobong manok?')
  assert.equal(answer.status, 'not_found')
  assert.deepEqual(labels(answer), [])
  const { rows } = await db.query('select count(*)::int as n from public.guidelines where source_document_id = $1', [SOURCE])
  assert.equal(rows[0].n, 0)
})

test('lifecycle: a question with no matching knowledge reports no verified source and cites nothing', async () => {
  const answer = await ask("What are the Dean's List requirements?")
  assert.equal(answer.status, 'not_found')
  assert.deepEqual(labels(answer), [])
})
