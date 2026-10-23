import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const nodeRequire = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
function load(relative, mocks = {}) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => (id in mocks ? mocks[id] : nodeRequire(id)), loaded, loaded.exports)
  return loaded.exports
}

// Only the pure answer-building step is exercised: retrieval, Claude and Supabase are stubbed out.
const stub = {}
const { handbookAnswer, NO_SOURCE_MESSAGE } = load('lib/ai/campus-agent.ts', {
  'server-only': stub,
  '@anthropic-ai/sdk': stub,
  '@anthropic-ai/sdk/helpers/zod': stub,
  '@/lib/ai/answer-types': load('lib/ai/answer-types.ts'),
  '@/lib/ai/anthropic': stub,
  '@/lib/ai/guardrail': stub,
  '@/lib/ai/language': stub,
  '@/lib/ai/preferences': stub,
  '@/lib/announcement-scopes': stub,
  '@/lib/ai/public-scope': stub,
  '@/lib/ai/query-expansion': stub,
  '@/lib/campus/announcement-match': stub,
  '@/lib/campus/announcements': stub,
  '@/lib/campus/location-match': stub,
  '@/lib/campus/locations': stub,
  '@/lib/campus/programs': stub,
  '@/lib/campus/programs-match': stub,
  '@/lib/supabase/public': stub,
  '@/lib/supabase/server': stub,
  '@/lib/supabase/types': stub,
  '@/lib/rag/search': stub,
})

const passages = [
  { sourceLabel: 'WUP Handbook -Section 1', documentTitle: 'WUP Handbook', pageNumber: 1, sectionTitle: 'Graduation Honors', content: 'Graduation honors…' },
  { sourceLabel: 'WUP Handbook -Section 3 — Page 5', documentTitle: 'WUP Handbook', pageNumber: 5, sectionTitle: '5. Leave of Absence', content: 'The handbook does not state a leave of absence procedure.' },
]
const reply = (fields) => ({ coverage: 'partial', summary: '', steps: [], requirements: [], details: '', gaps: '', source_ids: [], ...fields })

test('no relevant source ("none") is never shown with a handbook citation, even if Claude lists ids', () => {
  const answer = handbookAnswer(
    reply({ coverage: 'none', summary: "The handbook sources provided don't mention a Dean's List or its requirements.", gaps: "None of the sources discuss a Dean's List.", source_ids: [1] }),
    passages,
    'en',
  )
  assert.equal(answer.status, 'not_found')
  assert.deepEqual(answer.sources, [])
  assert.equal(answer.summary, NO_SOURCE_MESSAGE)
  assert.equal(answer.text.includes('WUP Handbook'), false)
})

test('a source that addresses the topic but lacks the procedure keeps its citation as a partial answer', () => {
  const answer = handbookAnswer(
    reply({ summary: 'The handbook does not state a Leave of Absence procedure.', gaps: 'No Leave of Absence procedure is provided.', source_ids: [2] }),
    passages,
    'en',
  )
  assert.equal(answer.status, 'partial')
  assert.deepEqual(answer.sources.map((s) => s.label), ['WUP Handbook -Section 3 — Page 5'])
})

test('citations only come from retrieved passages: unknown ids are dropped', () => {
  const answer = handbookAnswer(reply({ coverage: 'full', summary: 'Honors are based on GWA.', source_ids: [1, 9, 1] }), passages, 'en')
  assert.equal(answer.status, 'answered')
  assert.deepEqual(answer.sources.map((s) => s.label), ['WUP Handbook -Section 1'])
})

test('complete multi-source knowledge answers have no generic limitation note even if the model supplies stale gaps', () => {
  const answer = handbookAnswer(reply({ coverage: 'full', summary: 'The fee is \u20b1100.', gaps: 'Not covered by the handbook.', source_ids: [1] }), passages, 'en')
  assert.equal(answer.status, 'answered')
  assert.equal(answer.gaps, '')
  assert.doesNotMatch(answer.text, /Not covered|handbook:/i)
})

test('partial answers retain supported facts and a specific natural omission, distinct from not-found', () => {
  const answer = handbookAnswer(reply({ summary: 'Visit the Office of Student Affairs for the certificate.', gaps: 'The available university information does not specify the complete procedure.', source_ids: [2] }), passages, 'en')
  assert.equal(answer.status, 'partial')
  assert.match(answer.text, /Office of Student Affairs/)
  assert.match(answer.text, /does not specify the complete procedure/)
  assert.doesNotMatch(answer.text, /Not covered by the handbook/)
  assert.equal(answer.sources.length, 1)
})
