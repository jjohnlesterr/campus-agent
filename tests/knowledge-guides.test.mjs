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
function database(snapshot = { source: { id: sourceId, title: 'Student Handbook', status: 'ready', mime_type: 'application/pdf', visibility: 'public' }, chunks: sections }, options = {}) {
  const state = { source: { visibility: 'public', ...snapshot.source }, chunks: structuredClone(snapshot.chunks).map(c => ({ metadata: { page_count: 4 }, ...c, document_id: snapshot.source.id })), guides: [], categories: structuredClone(options.categories ?? []), offices: structuredClone(options.offices ?? []), steps: [], writes: [], mutations: [], revision: 0 }
  const db = {
    from(table) {
      let operation = 'select', values, settings
      const filters = []
      const query = {
        select() { return query }, order() { return query }, limit() { return query },
        eq(k, v) { filters.push(r => r[k] === v); return query },
        in(k, v) { filters.push(r => v.includes(r[k])); return query },
        neq(k, v) { filters.push(r => r[k] !== v); return query },
        gt(k, v) { filters.push(r => r[k] > v); return query },
        upsert(v, s) { operation = 'upsert'; values = Array.isArray(v) ? v : [v]; settings = s; return query },
        insert(v) { operation = 'insert'; values = Array.isArray(v) ? v : [v]; return query },
        update(v) { operation = 'update'; values = v; return query },
        delete() { operation = 'delete'; return query },
        single: async () => execute(true), maybeSingle: async () => execute(true),
        then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject) },
      }
      function execute(single) {
        const rows = table === 'documents' ? [state.source] : table === 'document_chunks' ? state.chunks : table === 'guidelines' ? state.guides : table === 'guideline_categories' ? state.categories : table === 'guideline_steps' ? state.steps : table === 'offices' ? state.offices : []
        const selected = rows.filter(r => filters.every(f => f(r)))
        if (operation === 'select') return { data: single ? selected[0] ?? null : selected, error: null }
        state.writes.push(table)
        state.mutations.push({ table, operation, values: structuredClone(values) })
        assert(table !== 'document_chunks' && (table !== 'documents' || options.allowSourceUpdates), 'Sources/chunks must never be mutated')
        if (table === 'guideline_steps' && options.stepFailure) return { data: null, error: { message: 'step write rejected' } }
        if (operation === 'update') {
          if (table === 'guidelines' && options.statusFailure) return { data: null, error: { message: 'status write rejected' } }
          for (const row of selected) Object.assign(row, values, { updated_at: new Date(Date.UTC(2026, 9, 2, 0, 0, ++state.revision)).toISOString() })
          return { data: single ? selected[0] ?? null : selected, count: selected.length, error: null }
        }
        if (operation === 'delete') {
          for (const row of selected) rows.splice(rows.indexOf(row), 1)
          return { data: single ? selected[0] ?? null : selected, error: null }
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
    'next/cache': { revalidatePath: () => {} }, 'next/navigation': { redirect: (to) => { state.redirectedTo = to } },
    '@/lib/auth': { requireAdmin: async () => { if (options.authFailure) throw Error('Unauthorized') } },
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/knowledge/topics': topics,
  })
  const analyze = load('lib/knowledge/analyze.ts', {
    'server-only': {}, '@/lib/knowledge/generation': generation, '@/lib/knowledge/topics': topics,
    '@/lib/rag/ingest': { ingestDocument: async () => options.ingestResult ?? { ok: true, pages: 4, chunks: 4, embedded: 0 } },
    '@/lib/ai/anthropic': { CLAUDE_MODEL: 'test-model', getAnthropic: () => ({ messages: { parse: async (request) => {
      state.claudeRequests = [...(state.claudeRequests ?? []), request]
      if (options.claudeFailure) throw new Error('Claude unavailable')
      return { stop_reason: 'end_turn', parsed_output: options.claudeOutput }
    } } }) },
  })
  return { state, db, ...generation, ...actions, ...analyze }
}
const categoryId = '32345678-1234-4234-8234-123456789abc'
function edits(guide) {
  return { id: guide.id, updatedAt: guide.updated_at, title: 'Reviewed title', categoryId, description: 'Reviewed description.', content: 'Reviewed content from the handbook.', requirements: ['University requirement'], steps: [{ title: 'Verified first step.', description: 'Verified detail.' }], pages: topics.readGuideReference(guide.source_reference).pages, referenceNote: '', visibility: 'public', responsibleOfficeId: null, intent: 'draft', reviewed: false }
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
  // Content is the verbatim extracted text of every merged chunk, in order.
  assert.equal(state.guides[0].content, sections.slice(0, 2).map(c => c.content).join('\n\n'))
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
  const { saveGuide, unpublishGuide, setGuideStatuses, setGuideArchived, deleteGuide, createManualEntry } = database(undefined, { authFailure: true })
  await assert.rejects(saveGuide({}), /Unauthorized/); await assert.rejects(unpublishGuide(sourceId), /Unauthorized/)
  await assert.rejects(setGuideArchived(sourceId, true), /Unauthorized/); await assert.rejects(deleteGuide(sourceId), /Unauthorized/)
  await assert.rejects(createManualEntry({}, new FormData()), /Unauthorized/)
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
const library = load('lib/knowledge/library.ts')
test('library tabs are All / Published / Drafts / Archived, with safe defaults for old links', () => {
  assert.deepEqual(library.LIBRARY_TABS.map(t => t.value), ['all', 'published', 'draft', 'archived'])
  assert.equal(library.libraryTab('draft'), 'draft'); assert.equal(library.libraryTab(['draft']), 'all'); assert.equal(library.libraryTab('bogus'), 'all')
  assert.equal(library.libraryTab('pdf'), 'all', 'old ?tab=pdf links show All'); assert.equal(library.libraryTab('manual'), 'all', 'old ?tab=manual links show All')
  const [handbook, map] = library.buildSources([
    { id: 'pdf', title: 'Student Handbook 2026', status: 'ready', mime_type: 'application/pdf', document_type: 'handbook', summary: 'Policies and procedures', key_topics: ['Enrollment'], updated_at: '2026-10-01T00:00:00+00:00' },
    { id: 'map', title: 'Campus Map', status: 'archived', mime_type: 'image/png', document_type: 'campus_map', summary: null, key_topics: [], updated_at: '2026-10-01T00:00:00+00:00' },
  ], [
    { source_document_id: 'pdf', status: 'published', updated_at: '2026-10-03T00:00:00+00:00' },
    { source_document_id: 'pdf', status: 'draft', updated_at: '2026-10-02T00:00:00+00:00' },
    { source_document_id: null, status: 'draft', updated_at: '2026-10-05T00:00:00+00:00' },
  ])
  assert.deepEqual(handbook.counts, { total: 2, published: 1, draft: 1, archived: 0 })
  assert.equal(handbook.updatedAt, '2026-10-03T00:00:00+00:00')
  const manual = { kind: 'manual', id: 'm', title: 'How to contact the Registrar', status: 'published', category: 'Student Services', description: null, updatedAt: '2026-10-04T00:00:00+00:00' }
  const items = [handbook, map, manual]
  const ids = (tab, q = '') => library.filterLibrary(items, tab, q).map(i => i.id)
  assert.deepEqual(ids('all'), ['m', 'pdf'])
  assert.deepEqual(ids('published'), ['m', 'pdf']); assert.deepEqual(ids('draft'), ['pdf']); assert.deepEqual(ids('archived'), ['map'])
  assert.deepEqual(ids('all', 'registrar'), ['m']); assert.deepEqual(ids('all', 'enrollment'), ['pdf'])
})
test('analysis creates only Draft sections, keeps Published ones, and applies AI suggestions to new drafts only', async () => {
  const office = { id: '42345678-1234-4234-8234-123456789abc', name: 'Office of the Registrar', short_name: 'Registrar' }
  const categories = [{ id: categoryId, name: 'Graduation', sort_order: 1 }]
  const claudeOutput = { summary: 'Academic policies for students.', key_topics: ['Graduation', 'Transfer', 'Graduation'], sections: [
    { id: 1, category: 'Graduation', summary: 'Honors criteria.', office: 'Office of the Registrar' },
    { id: 2, category: 'Unknown category', summary: 'Transfer steps.', office: 'Office of the Registrar' },
    { id: 3, category: 'Graduation', summary: 'Leave of absence.', office: '' },
  ] }
  const { state, db, createDraftGuides, analyzeSource } = database(undefined, { allowSourceUpdates: true, categories, offices: [office], claudeOutput })
  // An existing Published section for the first topic must survive re-analysis untouched.
  await createDraftGuides(db, sourceId)
  state.guides.splice(1)
  Object.assign(state.guides[0], { status: 'published', description: 'Admin-approved text' })
  const before = structuredClone(state.guides[0])
  const result = await analyzeSource(db, sourceId)
  assert.equal(result.ok, true); assert.equal(result.created, 2); assert.equal(result.skipped, 1); assert.equal(result.overview, true)
  assert.deepEqual(state.guides[0], before)
  const created = state.guides.slice(1)
  assert(created.every(g => g.status === 'draft'))
  assert.equal(created[0].description, 'Transfer steps.')
  assert.notEqual(created[0].category_id, categoryId, 'unknown categories are ignored')
  assert.equal(created[0].responsible_office_id, null, 'an office not named in the section text is never assigned')
  assert.equal(created[1].category_id, categoryId)
  assert.equal(state.source.summary, 'Academic policies for students.')
  assert.deepEqual(state.source.key_topics, ['Graduation', 'Transfer'])
  assert(state.source.analyzed_at)
  assert.match(state.claudeRequests[0].messages[0].content, /<section id="1" title="Graduation Honors">/)
})
test('analysis still creates drafts when the AI overview is unavailable, and stops on extraction failure', async () => {
  const failing = database(undefined, { allowSourceUpdates: true, claudeFailure: true })
  const result = await failing.analyzeSource(failing.db, sourceId)
  assert.equal(result.ok, true); assert.equal(result.overview, false); assert.equal(result.created, 3)
  assert(failing.state.guides.every(g => g.status === 'draft'))
  const broken = database(undefined, { allowSourceUpdates: true, ingestResult: { ok: false, error: 'No selectable text.' } })
  assert.deepEqual(await broken.analyzeSource(broken.db, sourceId), { ok: false, error: 'No selectable text.' })
  assert.equal(broken.state.guides.length, 0)
  const image = database(undefined, { allowSourceUpdates: true }); image.state.source.mime_type = 'image/png'
  assert.equal((await image.analyzeSource(image.db, sourceId)).ok, false)
})
test('archive, restore and delete follow section status rules', async () => {
  const { state, db, createDraftGuides, setGuideArchived, deleteGuide } = database(); await createDraftGuides(db, sourceId)
  const [published, draft] = state.guides
  published.status = 'published'
  assert.equal((await deleteGuide(published.id)).ok, false); assert(state.guides.includes(published))
  assert.equal((await setGuideArchived(published.id, true)).ok, true); assert.equal(published.status, 'archived')
  assert.equal((await setGuideArchived(published.id, false)).ok, true); assert.equal(published.status, 'draft', 'restored sections need review again')
  assert.equal((await deleteGuide(draft.id)).ok, true); assert(!state.guides.includes(draft))
})
test('manual entries need no source file and can be created as Draft or Published', async () => {
  const { state, createManualEntry, saveGuide } = database()
  const form = (values) => { const data = new FormData(); for (const [k, v] of Object.entries(values)) data.set(k, v); return data }
  const entry = { title: 'How to contact the Registrar', categoryId, content: 'Email the Registrar at the address on the official website.', responsibleOfficeId: '', referenceNote: 'Registrar memo', visibility: 'authenticated', status: 'draft' }
  assert.match((await createManualEntry({}, form({ ...entry, content: 'short' }))).error, /content/)
  assert.equal(state.guides.length, 0)
  await createManualEntry({}, form(entry))
  const [created] = state.guides
  assert.equal(created.status, 'draft'); assert.equal(created.source_document_id, undefined); assert.equal(created.source_reference, 'Registrar memo')
  assert.equal(created.content, entry.content); assert.match(state.redirectedTo, new RegExp(created.id))
  // Manual entries publish without the source review checkbox.
  const saved = await saveGuide({ ...edits({ ...created, source_reference: JSON.stringify({ version: 1, topic: 't', chunkIds: [], pages: [1] }) }), pages: [], referenceNote: 'Registrar memo', intent: 'published', reviewed: false })
  assert.equal(saved.ok, true); assert.equal(created.status, 'published'); assert.equal(created.source_reference, 'Registrar memo')
  await createManualEntry({}, form({ ...entry, title: 'Published entry', status: 'published' }))
  assert.equal(state.guides[1].status, 'published')
})
const search = load('lib/rag/search.ts', { 'server-only': {}, '@/lib/knowledge/topics': topics, '@/lib/supabase/server': { createClient: async () => { throw Error('use the passed client') } } })
test('retrieval cites the source title and preserved pages, or the manual entry and its note', async () => {
  const rows = [
    { section_id: 'a', title: 'Graduation honors', source_id: sourceId, source_title: 'Information WUP', source_reference: JSON.stringify({ version: 1, topic: 'graduation honors', chunkIds: [], pages: [1, 2] }), content: 'Honors text', rank: 2 },
    { section_id: 'b', title: 'How to contact the Registrar', source_id: null, source_title: null, source_reference: 'Registrar memo', content: 'Contact text', rank: 1 },
  ]
  const calls = []
  const client = { rpc: async (name, args) => { calls.push([name, args]); return { data: rows, error: null } } }
  const passages = await search.searchKnowledge('honors', { limit: 3, supabase: client })
  assert.deepEqual(calls, [['search_knowledge', { query_text: 'honors', match_count: 3 }]])
  assert.equal(passages[0].sourceLabel, 'Information WUP — Pages 1, 2'); assert.equal(passages[0].pageNumber, 1); assert.equal(passages[0].sectionTitle, 'Graduation honors')
  assert.equal(passages[1].sourceLabel, 'How to contact the Registrar — Registrar memo'); assert.equal(passages[1].pageNumber, null)
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
const order = (state) => Object.fromEntries(state.guides.map(g => [g.title, [g.source_order, g.status]]))
test('generated sections keep the order of their topics in the PDF', async () => {
  const { state, db, createDraftGuides } = database()
  await createDraftGuides(db, sourceId)
  // Chunk order: Graduation Honors (pages 1–2), Transfer (3), Leave of Absence (4). Not alphabetical.
  assert.deepEqual(state.guides.map(g => [g.source_order, g.title]).sort((a, b) => a[0] - b[0]), [[1, 'Graduation Honors'], [2, 'Transfer'], [3, 'Leave of Absence']])
})
test('re-analysis follows the new PDF order, archives stale drafts and leaves admin-added sections alone', async () => {
  const { state, db, createDraftGuides } = database()
  await createDraftGuides(db, sourceId)
  state.guides.push({ id: '52345678-1234-4234-8234-123456789abc', title: 'Library Hours', slug: `source-${sourceId}-section-62345678-1234-4234-8234-123456789abc`, status: 'draft', source_document_id: sourceId, source_reference: JSON.stringify({ version: 1, topic: 'library hours', chunkIds: [], pages: [2] }), source_order: null })
  state.guides.find(g => g.title === 'Graduation Honors').status = 'published'
  // Updated PDF: Transfer moved to the front, Leave of Absence removed.
  state.chunks = [{ ...state.chunks[2], chunk_index: 0 }, { ...state.chunks[0], chunk_index: 1 }, { ...state.chunks[1], chunk_index: 2 }]
  const result = await createDraftGuides(db, sourceId)
  assert.equal(result.ok, true); assert.equal(result.created, 0); assert.equal(result.archivedStale, 1); assert.equal(result.stalePublished, 0)
  assert.deepEqual(order(state), {
    'Transfer': [1, 'draft'], 'Graduation Honors': [2, 'published'],
    'Leave of Absence': [null, 'archived'], 'Library Hours': [null, 'draft'],
  })
  assert.equal(state.guides.length, 4, 'nothing is deleted or duplicated')
})
test('a Published section whose topic left the PDF stays live and is reported for review', async () => {
  const { state, db, createDraftGuides } = database()
  await createDraftGuides(db, sourceId)
  state.guides.find(g => g.title === 'Leave of Absence').status = 'published'
  state.chunks = state.chunks.slice(0, 3)
  const result = await createDraftGuides(db, sourceId)
  assert.equal(result.stalePublished, 1); assert.equal(result.archivedStale, 0)
  assert.deepEqual(order(state)['Leave of Absence'], [null, 'published'])
})
