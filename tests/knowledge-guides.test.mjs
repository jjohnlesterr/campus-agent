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
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => id in mocks ? mocks[id] : nodeRequire(id), loaded, loaded.exports)
  return loaded.exports
}
const topics = load('lib/knowledge/topics.ts')
const sourceId = '12345678-1234-4234-8234-123456789abc'
const sections = [
  { id: '12345678-1234-4234-8234-123456789ab1', chunk_index: 0, page_number: 1, section_title: '3. Graduation Honors', content: '3. Graduation Honors Students must meet the stated academic criteria. The handbook sets minimum grades for graduation honors.' },
  { id: '12345678-1234-4234-8234-123456789ab2', chunk_index: 1, page_number: 2, section_title: 'GRADUATION HONORS', content: 'Consult the Registrar for further information.' },
  { id: '12345678-1234-4234-8234-123456789ab3', chunk_index: 2, page_number: 3, section_title: '4. Transfer', content: '4. Transfer A student must: 1. Submit a written request. 2. Settle financial obligations. Students must observe the university rules.' },
  { id: '12345678-1234-4234-8234-123456789ab4', chunk_index: 3, page_number: 4, section_title: '5. Leave of Absence', content: '5. Leave of Absence The handbook does not state a leave of absence procedure or specific requirements.' },
]
function database(snapshot = { source: { id: sourceId, status: 'ready', mime_type: 'application/pdf', visibility: 'public' }, chunks: sections }, options = {}) {
  const state = { source: { visibility: 'public', ...snapshot.source }, chunks: structuredClone(snapshot.chunks).map(c => ({ ...c, document_id: snapshot.source.id })), guides: [], categories: [], steps: [], writes: [], mutations: [], revision: 0 }
  const db = {
    from(table) {
      let operation = 'select', values, settings
      const filters = []
      const query = {
        select() { return query }, order() { return query },
        eq(k, v) { filters.push(r => r[k] === v); return query },
        in(k, v) { filters.push(r => v.includes(r[k])); return query },
        gt(k, v) { filters.push(r => r[k] > v); return query },
        upsert(v, s) { operation = 'upsert'; values = Array.isArray(v) ? v : [v]; settings = s; return query },
        insert(v) { operation = 'insert'; values = Array.isArray(v) ? v : [v]; return query },
        update(v) { operation = 'update'; values = v; return query },
        delete() { operation = 'delete'; return query },
        single: async () => execute(true), maybeSingle: async () => execute(true),
        then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject) },
      }
      function execute(single) {
        const rows = table === 'documents' ? [state.source] : table === 'document_chunks' ? state.chunks : table === 'guidelines' ? state.guides : table === 'guideline_categories' ? state.categories : table === 'guideline_steps' ? state.steps : []
        const selected = rows.filter(r => filters.every(f => f(r)))
        if (operation === 'select') return { data: single ? selected[0] ?? null : selected, error: null }
        state.writes.push(table)
        state.mutations.push({ table, operation, values: structuredClone(values) })
        assert(!['documents', 'document_chunks'].includes(table), 'Sources/chunks must never be mutated')
        if (table === 'guideline_steps' && options.stepFailure) return { data: null, error: { message: 'step write rejected' } }
        if (operation === 'update') {
          if (table === 'guidelines' && options.statusFailure) return { data: null, error: { message: 'status write rejected' } }
          for (const row of selected) Object.assign(row, values, { updated_at: new Date(Date.UTC(2026, 9, 2, 0, 0, ++state.revision)).toISOString() })
          return { data: single ? selected[0] ?? null : selected, count: selected.length, error: null }
        }
        if (operation === 'delete') {
          for (const row of selected) rows.splice(rows.indexOf(row), 1)
          return { data: null, error: null }
        }
        const changed = []
        for (const value of values) {
          const key = settings?.onConflict?.split(',') ?? []
          const previous = key.length ? rows.find(r => key.every(k => r[k] === value[k])) : null
          if (previous && settings.ignoreDuplicates) continue
          if (previous) { Object.assign(previous, value); changed.push(previous) }
          else { const row = { id: `22345678-1234-4234-8234-${String(rows.length + 1).padStart(12, '0')}`, updated_at: '2026-10-02T00:00:00.000Z', ...value }; rows.push(row); changed.push(row) }
        }
        return { data: single ? changed[0] ?? null : changed, error: null }
      }
      return query
    },
  }
  const generation = load('lib/knowledge/generation.ts', { 'server-only': {}, '@/lib/knowledge/topics': topics })
  const actions = load('app/admin/knowledge/actions.ts', {
    'next/cache': { revalidatePath: () => {} }, '@/lib/auth': { requireAdmin: async () => { if (options.authFailure) throw Error('Unauthorized') } },
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/knowledge/generation': generation, '@/lib/knowledge/topics': topics,
  })
  return { state, db, ...generation, ...actions }
}
function edits(guide) {
  return { id: guide.id, updatedAt: guide.updated_at, title: 'Reviewed title', description: 'Reviewed description.', requirements: ['University requirement'], steps: [{ title: 'Verified first step.', description: 'Verified detail.' }], pages: topics.readGuideReference(guide.source_reference).pages, responsibleOfficeId: null, intent: 'draft', reviewed: false }
}

test('same-topic chunks merge across pages and preserve exact references', () => {
  const grouped = topics.groupSourceSections([...sections].reverse())
  assert.equal(grouped.length, 3)
  assert.equal(grouped[0].sections.length, 2)
  assert.deepEqual(topics.topicReference(grouped[0]).pages, [1, 2])
  assert.deepEqual(topics.topicReference(grouped[0]).chunkIds, sections.slice(0, 2).map(c => c.id))
  assert.equal(grouped[2].steps.length, 0)
  assert.equal(grouped[2].requirements.length, 0)
  assert.match(grouped[2].description, /does not state/)
  assert.deepEqual(grouped[1].steps.map(s => s.title), ['Submit a written request.', 'Settle financial obligations.'])
})
test('generation creates drafts from stored chunks and never overwrites manual edits', async () => {
  const { state, db, createDraftGuides } = database()
  const original = structuredClone(state.chunks)
  assert.equal((await createDraftGuides(db, sourceId)).created, 3)
  assert(state.guides.every(g => g.status === 'draft'))
  Object.assign(state.guides[0], { title: 'Manually renamed', description: 'Manually edited', status: 'published' })
  const repeated = await createDraftGuides(db, sourceId)
  assert.equal(repeated.created, 0); assert.equal(repeated.skipped, 3)
  assert.equal(state.guides[0].description, 'Manually edited'); assert.equal(state.guides[0].status, 'published')
  assert.deepEqual(state.chunks, original)
})
test('overlapping chunks do not duplicate numbered steps, and section numbers normalize', () => {
  const repeated = { ...sections[2], id: '12345678-1234-4234-8234-123456789ab5', chunk_index: 5, page_number: 4 }
  const transfer = topics.groupSourceSections([sections[2], repeated])[0]
  assert.equal(transfer.steps.length, 2)
  assert.equal(topics.topicKey('5.3 Incomplete Grade'), topics.topicKey('Incomplete Grade'))
  assert.notEqual(topics.topicKey('2026 Calendar'), topics.topicKey('2027 Calendar'))
})
test('parallel generation uses the existing unique slug constraint', async () => {
  const { state, db, createDraftGuides } = database()
  await Promise.all([createDraftGuides(db, sourceId), createDraftGuides(db, sourceId)])
  assert.equal(state.guides.length, 3); assert.equal(new Set(state.guides.map(g => g.slug)).size, 3); assert.equal(state.steps.length, 2)
})
test('images and non-Ready sources cannot generate guides', async () => {
  for (const change of [{ mime_type: 'image/png' }, { status: 'failed' }]) {
    const { state, db, createDraftGuides } = database(); Object.assign(state.source, change)
    assert.equal((await createDraftGuides(db, sourceId)).ok, false); assert.equal(state.guides.length, 0)
  }
})
test('review, save, publish, and unpublish enforce Draft/Published workflow', async () => {
  const { state, db, createDraftGuides, saveGuide, unpublishGuide } = database(); await createDraftGuides(db, sourceId)
  const guide = state.guides[0]
  assert.equal((await saveGuide({ ...edits(guide), intent: 'published' })).ok, false); assert.equal(guide.status, 'draft')
  assert.equal((await saveGuide(edits(guide))).ok, true); assert.equal(guide.status, 'draft')
  assert.equal((await saveGuide({ ...edits(guide), intent: 'published', reviewed: true })).ok, true); assert.equal(guide.status, 'published')
  assert.equal((await db.from('guidelines').select('*').eq('status', 'published')).data.length, 1)
  assert.equal((await unpublishGuide(guide.id)).ok, true); assert.equal(guide.status, 'draft')
})
test('stale edits and unsupported page references cannot overwrite a guide', async () => {
  const { state, db, createDraftGuides, saveGuide } = database(); await createDraftGuides(db, sourceId)
  const guide = state.guides[0], values = edits(guide)
  assert.equal((await saveGuide({ ...values, pages: [99] })).ok, false)
  assert.equal((await saveGuide(values)).ok, true)
  assert.equal((await saveGuide({ ...values, title: 'Stale overwrite' })).ok, false); assert.equal(guide.title, values.title)
})
test('failed step persistence leaves a Draft, never a partially published guide', async () => {
  const { state, db, createDraftGuides, saveGuide } = database(undefined, { stepFailure: true }); await createDraftGuides(db, sourceId)
  const guide = state.guides[0]; guide.status = 'published'
  assert.equal((await saveGuide({ ...edits(guide), intent: 'published', reviewed: true })).ok, false); assert.equal(guide.status, 'draft')
})
test('visibility remains inherited from the source', async () => {
  const { state, db, createDraftGuides, saveGuide } = database(); state.source.visibility = 'authenticated'; await createDraftGuides(db, sourceId)
  const guide = state.guides[0]; assert.equal(guide.visibility, 'authenticated')
  assert.equal((await saveGuide({ ...edits(guide), intent: 'published', reviewed: true })).ok, true); assert.equal(guide.visibility, 'authenticated')
})
test('all mutations still require an admin', async () => {
  const { generateSourceGuides, saveGuide, unpublishGuide, setGuideStatuses } = database(undefined, { authFailure: true })
  await assert.rejects(generateSourceGuides(sourceId), /Unauthorized/); await assert.rejects(saveGuide({}), /Unauthorized/); await assert.rejects(unpublishGuide(sourceId), /Unauthorized/)
  await assert.rejects(setGuideStatuses([sourceId], 'published'), /Unauthorized/)
})
test('bulk actions change only the matching status in mixed selections and preserve every content/reference field', async () => {
  const { state, db, createDraftGuides, setGuideStatuses } = database()
  await createDraftGuides(db, sourceId)
  state.guides[1].status = 'published'
  state.guides[2].status = 'archived'
  const before = structuredClone(state)
  const ids = state.guides.map(g => g.id)
  const result = await setGuideStatuses([...ids, ids[0]], 'published')
  assert.equal(result.ok, true); assert.equal(result.updated, 1); assert.equal(result.skipped, 2)
  assert.deepEqual(state.guides.map(g => g.status), ['published', 'published', 'archived'])
  const content = guides => guides.map(guide => {
    const copy = { ...guide }; delete copy.status; delete copy.updated_at; return copy
  })
  assert.deepEqual(content(state.guides), content(before.guides))
  assert.deepEqual(state.steps, before.steps); assert.deepEqual(state.source, before.source); assert.deepEqual(state.chunks, before.chunks)
  assert.deepEqual(state.mutations.slice(before.mutations.length).map(m => ({ ...m })), [{ table: 'guidelines', operation: 'update', values: { status: 'published' } }])
  assert.equal((await db.from('guidelines').select('*').eq('status', 'published')).data.length, 2)
  const unpublished = await setGuideStatuses(ids, 'draft')
  assert.equal(unpublished.updated, 2); assert.equal(unpublished.skipped, 1)
  assert.deepEqual(state.guides.map(g => g.status), ['draft', 'draft', 'archived'])
  assert.equal((await db.from('guidelines').select('*').eq('status', 'published')).data.length, 0)
  assert.deepEqual(content(state.guides), content(before.guides)); assert.deepEqual(state.steps, before.steps)
})
test('bulk actions safely skip stale, missing, and unselected guides', async () => {
  const { state, db, createDraftGuides, setGuideStatuses } = database(); await createDraftGuides(db, sourceId)
  state.guides[0].status = 'published'
  const result = await setGuideStatuses([state.guides[0].id, state.guides[1].id, sourceId], 'published')
  assert.equal(result.updated, 1); assert.equal(result.skipped, 2)
  assert.equal(state.guides[2].status, 'draft')
  assert.equal((await setGuideStatuses([state.guides[2].id], 'draft')).updated, 0)
  assert.equal(state.guides[2].status, 'draft')
})
test('invalid bulk requests do not write, and failed status updates do not report success', async () => {
  const { state, setGuideStatuses } = database()
  for (const [ids, intent] of [[[], 'published'], [['bad-id'], 'published'], [[sourceId], 'archived']]) {
    assert.equal((await setGuideStatuses(ids, intent)).ok, false)
  }
  assert.equal(state.writes.length, 0)
  const failing = database(undefined, { statusFailure: true })
  await failing.createDraftGuides(failing.db, sourceId)
  const result = await failing.setGuideStatuses(failing.state.guides.map(g => g.id), 'published')
  assert.equal(result.ok, false); assert.match(result.error, /try again/)
  assert(failing.state.guides.every(g => g.status === 'draft'))
})
test('status and sorting inputs have safe defaults', () => {
  assert.deepEqual(topics.libraryOptions('published', 'az'), { status: 'published', sort: 'az' })
  assert.deepEqual(topics.libraryOptions('draft', 'oldest'), { status: 'draft', sort: 'oldest' })
  assert.deepEqual(topics.libraryOptions(['draft'], 'bad'), { status: 'all', sort: 'newest' })
})
if (process.env.CAMPUS_KB_SNAPSHOT) test('current Information-WUP sections produce merged drafts without duplicate generation', async () => {
  const snapshot = JSON.parse(fs.readFileSync(process.env.CAMPUS_KB_SNAPSHOT, 'utf8'))
  const { state, db, createDraftGuides } = database(snapshot), original = structuredClone(state.chunks)
  assert.equal((await createDraftGuides(db, snapshot.source.id)).ok, true)
  const honors = state.guides.filter(g => topics.topicKey(g.title) === 'graduation honors')
  assert.equal(honors.length, 1); assert.deepEqual(topics.readGuideReference(honors[0].source_reference).pages, [1, 2])
  assert.equal(state.guides.filter(g => topics.topicKey(g.title) === 'shifting transfer').length, 1)
  assert(state.guides.every(g => g.status === 'draft')); assert.equal((await createDraftGuides(db, snapshot.source.id)).created, 0)
  assert.deepEqual(state.chunks, original)
  console.log(JSON.stringify({ source: snapshot.source.file_name, reusedChunks: snapshot.chunks.length, draftTopics: state.guides.map(g => ({ title: g.title, pages: topics.readGuideReference(g.source_reference).pages, steps: state.steps.filter(s => s.guideline_id === g.id).length })) }))
})
