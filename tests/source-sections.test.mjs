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

const tables = load('lib/knowledge/tables.ts')
const topics = load('lib/knowledge/topics.ts', { '@/lib/knowledge/tables': tables })
const sources = load('lib/sources.ts')
const { toSourceSections, parsePageList, formatPageList } = load('lib/knowledge/sections.ts', { '@/lib/knowledge/topics': topics })

const ref = (pages) => JSON.stringify({ version: 1, topic: 't', chunkIds: [], pages })
const record = (over) => ({
  id: 'id', title: 'Title', content: 'Text', description: null, status: 'draft',
  source_reference: ref([]), source_order: null, requirements: [], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-08T00:00:00Z', guideline_steps: [], ...over,
})

test('sections follow the PDF order, never the alphabet; admin-added sections come after', () => {
  // Information WUP: three topics on page 1, in this order in the PDF.
  const sections = toSourceSections([
    record({ id: 'honors', title: 'Graduation honors', source_reference: ref([1, 2]), source_order: 3 }),
    record({ id: 'added', title: 'Admin note', source_reference: ref([1]), source_order: null, created_at: '2026-10-05T00:00:00Z' }),
    record({ id: 'inc', title: 'How to Comply with INC / Incomplete Grade', source_reference: ref([1]), source_order: 2 }),
    record({ id: 'clearance', title: 'Graduation Clearance', source_reference: ref([2]), source_order: 4 }),
    record({ id: 'enroll', title: 'How to Enroll', source_reference: ref([1]), source_order: 1 }),
  ])
  assert.deepEqual(sections.map((s) => s.id), ['enroll', 'inc', 'honors', 'clearance', 'added'])
  assert.equal(sections[2].pageLabel, 'Pages 1, 2', 'a topic spanning pages keeps all its pages')
  assert.equal(sections[0].pageLabel, 'Page 1')
})

test('sections without a stored order fall back to first page, then when they were added', () => {
  const sections = toSourceSections([
    record({ id: 'later', source_reference: ref([3]), created_at: '2026-10-02T00:00:00Z' }),
    record({ id: 'second', source_reference: ref([1]), created_at: '2026-10-03T00:00:00Z' }),
    record({ id: 'first', source_reference: ref([1]), created_at: '2026-10-01T00:00:00Z' }),
    record({ id: 'nopages', source_reference: ref([]) }),
  ])
  assert.deepEqual(sections.map((s) => s.id), ['first', 'second', 'later', 'nopages'])
})

test('each section shows its own text, falling back to the description for older sections', () => {
  const [withContent, olderOnly] = toSourceSections([
    record({ id: '1', content: '  Full text  ', description: 'Short', source_reference: ref([1]) }),
    record({ id: '2', content: null, description: 'Only a description', source_reference: ref([2]) }),
  ])
  assert.equal(withContent.content, 'Full text')
  assert.equal(olderOnly.content, 'Only a description')
})

test('steps are kept in step order alongside the section', () => {
  const [section] = toSourceSections([record({ guideline_steps: [
    { step_number: 2, title: 'Pay', description: null },
    { step_number: 1, title: 'Fill the form', description: 'At the Registrar' },
  ] })])
  assert.deepEqual(section.steps.map((s) => s.title), ['Fill the form', 'Pay'])
})

test('page field: lists, ranges and spaced dashes are parsed; anything else is rejected', () => {
  assert.deepEqual(parsePageList(''), [])
  assert.deepEqual(parsePageList('5, 4,4'), [4, 5])
  assert.deepEqual(parsePageList('4-6'), [4, 5, 6])
  assert.deepEqual(parsePageList('4 – 6, 9'), [4, 5, 6, 9])
  assert.equal(parsePageList('page 4'), null)
  assert.equal(parsePageList('0'), null)
  assert.equal(parsePageList('6-4'), null)
  assert.equal(formatPageList([5, 4, 4]), '4, 5')
})

// ---------------------------------------------------------------- inline edit (fake database)

const SECTION_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const UPDATED_AT = '2026-10-08T01:00:00.000Z'

function database({ pageCount = 12, stale = false, siblings = [] } = {}) {
  const state = { updates: [], inserts: [] }
  const db = {
    from: (table) => {
      let op = 'select', payload
      const filters = {}
      const q = {
        select: () => q, limit: () => q,
        update: (v) => ((op = 'update'), (payload = v), q),
        insert: (v) => { state.inserts.push({ table, payload: v }); return Promise.resolve({ error: null }) },
        upsert: () => Promise.resolve({ error: null }),
        eq: (col, val) => ((filters[col] = val), q),
        // Awaiting a list query: the source's sections.
        then: (resolve) => resolve({ data: op === 'select' && table === 'guidelines' ? siblings : null, error: null }),
        async single() { return this.maybeSingle() },
        async maybeSingle() {
          if (table === 'document_chunks') return { data: { metadata: { page_count: pageCount } }, error: null }
          if (table === 'documents') return { data: { status: 'ready', mime_type: 'application/pdf', visibility: 'public' }, error: null }
          if (table === 'guideline_categories') return { data: { id: 'cat' }, error: null }
          if (op === 'update') { state.updates.push({ payload, filters }); return { data: stale ? null : { id: SECTION_ID }, error: null } }
          return { data: { source_document_id: SOURCE_ID, source_reference: JSON.stringify({ version: 1, topic: 'inc', chunkIds: ['33333333-3333-4333-8333-333333333333'], pages: [1] }), description: 'Kept summary' }, error: null }
        },
      }
      return q
    },
  }
  const actions = load('app/admin/knowledge/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: () => {} },
    '@/lib/auth': { requireAdmin: async () => {} },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/knowledge/topics': topics,
    '@/lib/sources': sources,
  })
  return { state, ...actions }
}

test('editing a section keeps its status, summary and source link, and updates its pages', async () => {
  const { state, saveSectionText } = database()
  const result = await saveSectionText({ id: SECTION_ID, updatedAt: UPDATED_AT, title: 'How to Comply with INC', content: 'Corrected text.', pages: [1, 2] })
  assert.deepEqual(result, { ok: true })
  const [{ payload, filters }] = state.updates
  assert.deepEqual(Object.keys(payload).sort(), ['content', 'description', 'source_reference', 'title'], 'status is not touched')
  assert.equal(payload.description, 'Kept summary')
  assert.deepEqual(JSON.parse(payload.source_reference), { version: 1, topic: 'inc', chunkIds: ['33333333-3333-4333-8333-333333333333'], pages: [1, 2] })
  assert.equal(filters.updated_at, UPDATED_AT, 'stale edits are rejected')
})

test('page numbers beyond the PDF and stale edits are refused', async () => {
  const outOfRange = database({ pageCount: 12 })
  assert.match((await outOfRange.saveSectionText({ id: SECTION_ID, updatedAt: UPDATED_AT, title: 'INC', content: 'x', pages: [13] })).error, /1–12/)
  assert.equal(outOfRange.state.updates.length, 0)
  const stale = database({ stale: true })
  assert.match((await stale.saveSectionText({ id: SECTION_ID, updatedAt: UPDATED_AT, title: 'INC', content: 'x', pages: [1] })).error, /changed since you opened it/)
})

test('a section added by an admin starts as Draft and keeps its page reference', async () => {
  const { state, addSourceSection } = database()
  assert.deepEqual(await addSourceSection({ documentId: SOURCE_ID, title: 'Library Hours', content: 'Opens at 7:30 AM.', pages: [3] }), { ok: true })
  const [{ table, payload }] = state.inserts
  assert.equal(table, 'guidelines')
  assert.equal(payload.status, 'draft')
  assert.equal(payload.source_document_id, SOURCE_ID)
  assert.deepEqual(JSON.parse(payload.source_reference).pages, [3])
})

test('sections follow the admin order first, then the PDF order', () => {
  const sections = toSourceSections([
    record({ id: 'pdf-first', source_order: 1, sort_order: 2 }),
    record({ id: 'manual', source_order: null, sort_order: 1 }),
    record({ id: 'pdf-second', source_order: 2, sort_order: 3 }),
    record({ id: 'unplaced', source_order: 3, sort_order: null }),
  ])
  assert.deepEqual(sections.map((s) => s.id), ['manual', 'pdf-first', 'pdf-second', 'unplaced'])
})

test('a section added by an admin goes to the end of the list', async () => {
  const { state, addSourceSection } = database({ siblings: [{ sort_order: 1 }, { sort_order: 3 }, { sort_order: 2 }] })
  await addSourceSection({ documentId: SOURCE_ID, title: 'Library Hours', content: 'Opens at 7:30 AM.', pages: [3] })
  assert.equal(state.inserts[0].payload.sort_order, 4)
})
