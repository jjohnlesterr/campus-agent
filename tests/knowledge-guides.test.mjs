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
const tables = load('lib/knowledge/tables.ts')
const topics = load('lib/knowledge/topics.ts', { '@/lib/knowledge/tables': tables })
const sources = load('lib/sources.ts')
const sourceId = '12345678-1234-4234-8234-123456789abc'
const sections = [
  { id: '12345678-1234-4234-8234-123456789ab1', chunk_index: 0, page_number: 1, section_title: '3. Graduation Honors', content: '3. Graduation Honors Students must meet the stated academic criteria. The handbook sets minimum grades for graduation honors.' },
  { id: '12345678-1234-4234-8234-123456789ab2', chunk_index: 1, page_number: 2, section_title: 'GRADUATION HONORS', content: 'Consult the Registrar for further information.' },
  { id: '12345678-1234-4234-8234-123456789ab3', chunk_index: 2, page_number: 3, section_title: '4. Transfer', content: '4. Transfer Procedure: 1. Submit a written request. 2. Settle financial obligations. Students must observe the university rules.' },
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
  const generation = load('lib/knowledge/generation.ts', { 'server-only': {}, '@/lib/knowledge/topics': topics, '@/lib/sources': sources })
  const actions = load('app/admin/knowledge/actions.ts', {
    'next/cache': { revalidatePath: () => {} }, 'next/navigation': { redirect: (to) => { state.redirectedTo = to } },
    '@/lib/auth': { requireAdmin: async () => { if (options.authFailure) throw Error('Unauthorized') } },
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/knowledge/topics': topics, '@/lib/sources': sources,
  })
  const analyze = load('lib/knowledge/analyze.ts', {
    'server-only': {}, '@/lib/knowledge/generation': generation, '@/lib/knowledge/topics': topics, '@/lib/sources': sources,
    '@/lib/rag/ingest': { ingestDocument: async () => options.ingestResult ?? { ok: true, pages: 4, chunks: 4, embedded: 0, texts: options.texts ?? [] } },
    '@/lib/knowledge/outline': { outlineSource: async (title, lines) => { state.outlineLines = lines; return options.outline ?? null } },
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
  const { saveGuide, unpublishGuide, setGuideStatuses, setGuideArchived, deleteGuide } = database(undefined, { authFailure: true })
  await assert.rejects(saveGuide({}), /Unauthorized/); await assert.rejects(unpublishGuide(sourceId), /Unauthorized/)
  await assert.rejects(setGuideArchived(sourceId, true), /Unauthorized/); await assert.rejects(deleteGuide(sourceId), /Unauthorized/)
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
    { id: 'pdf', title: 'Student Handbook 2026', status: 'ready', mime_type: 'application/pdf', document_type: 'handbook', description: 'Rules for freshmen and transferees', summary: 'Policies and procedures', key_topics: ['Enrollment'], updated_at: '2026-10-01T00:00:00+00:00' },
    { id: 'map', title: 'Campus Map', status: 'archived', mime_type: 'image/png', document_type: 'campus_map', description: null, summary: null, key_topics: [], updated_at: '2026-10-01T00:00:00+00:00' },
  ], [
    { source_document_id: 'pdf', status: 'published', updated_at: '2026-10-03T00:00:00+00:00' },
    { source_document_id: 'pdf', status: 'draft', updated_at: '2026-10-02T00:00:00+00:00' },
    { source_document_id: null, status: 'draft', updated_at: '2026-10-05T00:00:00+00:00' },
  ])
  assert.deepEqual(handbook.counts, { total: 2, published: 1, draft: 1, archived: 0 })
  assert.equal(handbook.description, 'Rules for freshmen and transferees')
  assert.equal(handbook.updatedAt, '2026-10-03T00:00:00+00:00')
  const manual = { kind: 'manual', id: 'm', title: 'How to contact the Registrar', status: 'published', category: 'Student Services', description: null, updatedAt: '2026-10-04T00:00:00+00:00' }
  const items = [handbook, map, manual]
  const ids = (tab, q = '') => library.filterLibrary(items, tab, q).map(i => i.id)
  // Sources first, in the admin's drag-and-drop order; older manual entries after them.
  assert.deepEqual(ids('all'), ['pdf', 'm'])
  assert.deepEqual(ids('all', 'transferees'), ['pdf'], 'search matches the admin description')
  assert.deepEqual(ids('published'), ['pdf', 'm']); assert.deepEqual(ids('draft'), ['pdf']); assert.deepEqual(ids('archived'), ['map'])
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
test('existing manual entries publish without a source review or page reference', async () => {
  const { state, saveGuide } = database()
  const created = { id: '22345678-1234-4234-8234-000000000099', title: 'How to contact the Registrar', status: 'draft', source_reference: 'Registrar memo', updated_at: '2026-10-02T00:00:00.000Z' }
  state.guides.push(created)
  const saved = await saveGuide({ ...edits({ ...created, source_reference: JSON.stringify({ version: 1, topic: 't', chunkIds: [], pages: [1] }) }), pages: [], referenceNote: 'Registrar memo', intent: 'published', reviewed: false })
  assert.equal(saved.ok, true); assert.equal(created.status, 'published'); assert.equal(created.source_reference, 'Registrar memo')
})
test('text-source sections need no page reference; PDF sections still do', async () => {
  for (const [mime, ok] of [['text/plain', true], ['application/pdf', false]]) {
    const { state, saveGuide } = database({ source: { id: sourceId, title: 'Enrollment note', status: 'ready', mime_type: mime }, chunks: [] })
    const section = { id: '22345678-1234-4234-8234-000000000098', title: 'Enrollment', status: 'draft', source_document_id: sourceId, source_reference: JSON.stringify({ version: 1, topic: 'enrollment', chunkIds: [], pages: [] }), updated_at: '2026-10-02T00:00:00.000Z' }
    state.guides.push(section)
    const result = await saveGuide({ ...edits(section), pages: [], intent: 'draft' })
    assert.equal(result.ok, ok, mime)
    if (!ok) assert.match(result.error, /page reference/)
  }
})
test('a text source is organized into Draft sections like a PDF, without page references', async () => {
  const chunks = [
    { id: '42345678-1234-4234-8234-000000000001', chunk_index: 0, page_number: null, section_title: 'Enrollment note', content: 'This note clarifies enrollment for transferees.' },
    { id: '42345678-1234-4234-8234-000000000002', chunk_index: 1, page_number: null, section_title: 'Late enrollment', content: 'Late enrollment requires approval from the Registrar.' },
  ]
  const { state, db, createDraftGuides } = database({ source: { id: sourceId, title: 'Enrollment note', status: 'ready', mime_type: 'text/plain' }, chunks })
  const result = await createDraftGuides(db, sourceId)
  assert.equal(result.ok, true)
  assert.deepEqual(state.guides.map(g => g.title), ['Enrollment note', 'Late enrollment'])
  assert(state.guides.every(g => g.status === 'draft' && g.source_document_id === sourceId))
  assert(state.guides.every(g => topics.readGuideReference(g.source_reference).pages.length === 0))
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

// A handbook part shaped like the WUP "Admission & Academic Regulations" source.
const handbookPages = [
  [
    'SECTION 1', 'Admission & Academic Regulations', 'A. Admission Requirements',
    'The following documents must be submitted to the Registrar\'s Office upon registration:',
    '1. Incoming Freshmen and Transfer Students', '• Birth certificate issued by the PSA', '• Two (2) original copies of Certificate of Good Moral Character',
    '2. Foreign Students', '• Study permit from the Bureau of Immigration', 'Incoming students should consult the college of their choice.',
    'B. Guidelines on Registration', '1. Students seeking admission shall register during the prescribed period.', '2. No student may be registered later than the registration dates.',
  ].join('\n'),
  [
    '3. The duration of enrollment is for one term only.',
    'C. Academic Regulations', 'Student Attendance and Class Standing',
    '1. Students shall attend their classes regularly and punctually.', '2. A student who arrives late for more than 15 minutes shall be considered ABSENT.',
    'Grading System', 'Grade Equivalent Description', '1.00 98 & above Excellent', '5.00 Below 75 Failed',
    'Honors & Awards', 'Criteria for selection of honors:', '1. A candidate should complete 75% of the subjects.',
  ].join('\n'),
]
const outlineEntries = (lines) => {
  const at = (text) => lines.find(l => l.text === text).n
  return [
    { title: 'Admission & Academic Regulations', level: 0, startLine: at('SECTION 1'), heading: 'SECTION 1' },
    { title: 'Admission Requirements', level: 1, startLine: at('A. Admission Requirements'), heading: 'A. Admission Requirements' },
    { title: 'Incoming Freshmen and Transfer Students', level: 2, startLine: at('1. Incoming Freshmen and Transfer Students'), heading: '1. Incoming Freshmen and Transfer Students' },
    { title: 'Foreign Students', level: 2, startLine: at('2. Foreign Students'), heading: '2. Foreign Students' },
    { title: 'Guidelines on Registration', level: 1, startLine: at('B. Guidelines on Registration'), heading: 'B. Guidelines on Registration' },
    { title: 'Academic Regulations', level: 1, startLine: at('C. Academic Regulations'), heading: 'C. Academic Regulations' },
    // Off by one line: the heading is still found on the line before.
    { title: 'Student Attendance and Class Standing', level: 2, startLine: at('Student Attendance and Class Standing') + 1, heading: 'Student Attendance and Class Standing' },
    // An invented label is not allowed to become a title, and a heading not near its line is ignored.
    { title: 'Steps', level: 1, startLine: at('Grading System'), heading: 'Grading System' },
    { title: 'Foreign Students', level: 2, startLine: at('Grade Equivalent Description'), heading: '2. Foreign Students' },
    { title: 'Honors & Awards', level: 1, startLine: at('Honors & Awards'), heading: 'Honors & Awards' },
  ]
}

test('the AI heading outline keeps each main topic whole and never merges content across headings', () => {
  const lines = topics.sourceLines(handbookPages, true)
  const grouped = topics.topicsFromOutline(lines, outlineEntries(lines), [])
  assert.deepEqual(grouped.map(t => t.title), ['Admission Requirements', 'Guidelines on Registration', 'Academic Regulations', 'Grading System', 'Honors & Awards'])
  const [admission, registration, regulations, grading, honors] = grouped
  // Subsections stay under their parent; the document title opens the first section.
  assert.match(admission.content, /^SECTION 1\nAdmission & Academic Regulations\nA\. Admission Requirements/)
  assert.match(admission.content, /1\. Incoming Freshmen[\s\S]*2\. Foreign Students[\s\S]*consult the college of their choice\.$/)
  assert.doesNotMatch(admission.content, /register|ABSENT/)
  // Registration continues across the page break and stops at the next heading.
  assert.match(registration.content, /^B\. Guidelines on Registration[\s\S]*3\. The duration of enrollment is for one term only\.$/)
  assert.deepEqual(registration.pages, [1, 2])
  assert.match(regulations.content, /^C\. Academic Regulations\nStudent Attendance and Class Standing[\s\S]*ABSENT\.$/)
  // Tables stay whole inside their own section.
  assert.match(grading.content, /1\.00 98 & above Excellent\n5\.00 Below 75 Failed$/)
  assert.doesNotMatch(honors.content, /Excellent/)
  // Numbered policy rules are not turned into invented "Steps".
  assert(grouped.every(t => t.steps.length === 0))
  // Verbatim: every line of the source is in exactly one section.
  assert.equal(grouped.map(t => t.content).join('\n'), lines.map(l => l.text).join('\n'))
})

test('a main topic too large for one section splits into its subsections, which keep it as their parent', () => {
  const rules = Array.from({ length: 60 }, (_, i) => `${i + 1}. A student shall follow attendance rule number ${i + 1} of the University.`)
  const lines = topics.sourceLines([['C. Academic Regulations', 'Student Attendance and Class Standing', ...rules, 'Change of Subjects', 'Adding subjects is allowed within two weeks.'].join('\n')], true)
  const grouped = topics.topicsFromOutline(lines, [
    { title: 'Academic Regulations', level: 1, startLine: 1, heading: 'C. Academic Regulations' },
    { title: 'Student Attendance and Class Standing', level: 2, startLine: 2, heading: 'Student Attendance and Class Standing' },
    { title: 'Change of Subjects', level: 2, startLine: lines.length - 1, heading: 'Change of Subjects' },
  ], [])
  assert.deepEqual(grouped.map(t => [t.title, t.parent]), [['Student Attendance and Class Standing', 'Academic Regulations'], ['Change of Subjects', 'Academic Regulations']])
  assert.match(grouped[0].content, /^C\. Academic Regulations\nStudent Attendance and Class Standing\n1\. /)
  assert.match(grouped[0].description, /^Under “Academic Regulations”\./)
  assert.doesNotMatch(grouped[1].content, /attendance rule/)
})

test('labelled procedures still become steps, and chunk overlap is not duplicated', () => {
  const lines = topics.sourceLines(['Transfer', 'Procedure:', '1. Submit a written request.', '2. Settle financial obligations.'], false)
  const [transfer] = topics.topicsFromOutline(lines, [{ title: 'Transfer', level: 1, startLine: 1, heading: 'Transfer' }], [])
  assert.deepEqual(transfer.steps.map(s => s.title), ['Submit a written request.', 'Settle financial obligations.'])
  assert.deepEqual(transfer.pages, [])
  assert.equal(topics.joinChunks(['First rule. The overlap sentence is here.', 'The overlap sentence is here. Next rule.']), 'First rule. The overlap sentence is here.\n\nNext rule.')
})

test('re-analysis refreshes unedited AI drafts in place and never changes edited or Published sections', async () => {
  const lines = topics.sourceLines(handbookPages, true)
  const { state, db, createDraftGuides } = database()
  // First analysis: the old heading-based grouping.
  await createDraftGuides(db, sourceId)
  const first = await createDraftGuides(db, sourceId, { lines, entries: outlineEntries(lines) })
  assert.equal(first.outlined, true)
  // The old topics are not in the new outline: unedited drafts are archived, not duplicated.
  assert.equal(first.archivedStale, 3)
  const admission = state.guides.find(g => g.title === 'Admission Requirements')
  const registration = state.guides.find(g => g.title === 'Guidelines on Registration')
  admission.content = 'Admin-edited admission text.'
  registration.status = 'published'
  // The source changed: the last section on each page gains a line.
  const changed = topics.sourceLines(handbookPages.map(p => `${p}\nUpdated line.`), true)
  const result = await createDraftGuides(db, sourceId, { lines: changed, entries: outlineEntries(changed) })
  assert.equal(result.ok, true); assert.equal(result.created, 0)
  assert.equal(admission.content, 'Admin-edited admission text.', 'edited drafts are kept')
  assert.doesNotMatch(registration.content, /Updated line/, 'Published sections are kept')
  const honors = state.guides.find(g => g.title === 'Honors & Awards')
  assert.match(honors.content, /Updated line\.$/, 'unedited drafts are refreshed')
  assert.equal(result.refreshed, 1)
  assert.equal(state.guides.filter(g => g.title === 'Honors & Awards').length, 1, 'refreshed, not duplicated')
})

test('chunk headings include lettered headings but not table rows', () => {
  const chunk = load('lib/rag/chunk.ts')
  const chunks = chunk.chunkPages([handbookPages.join('\n')])
  const titles = [...new Set(chunks.map(c => c.sectionTitle))]
  assert(titles.includes('B. Guidelines on Registration'))
  assert(!titles.some(t => /Below 75/.test(t ?? '')))
})

test('a long topic whose subsections are short items (a timeline) stays one section', () => {
  const years = Array.from({ length: 50 }, (_, i) => [`${1946 + i}`, `In ${1946 + i} the University opened a new building and expanded its programs for students of the region.`]).flat()
  const lines = topics.sourceLines([['History of the University', ...years].join('\n')], true)
  const entries = [{ title: 'History of the University', level: 1, startLine: 1, heading: 'History of the University' },
    ...lines.filter(l => /^\d{4}$/.test(l.text)).map(l => ({ title: l.text, level: 2, startLine: l.n, heading: l.text }))]
  const grouped = topics.topicsFromOutline(lines, entries, [])
  assert.deepEqual(grouped.map(t => t.title), ['History of the University'])
  assert(grouped[0].content.length > 4000)
})

// Positioned text of the "Request for Academic Records" table, in the PDF's own item order
// (cell by cell; wrapped cells continue at the same x on lower lines).
const item = (str, x, y, hasEOL = false) => ({ str, x, y, width: str.length * 5.5, hasEOL })
const recordsLayout = [
  item('Request for Academic Records', 72, 425, true),
  item('The requirements, fees, and processing periods for requested documents are as follows:', 72, 401, true),
  item('Document', 77, 376), item('Requirements', 194, 376), item('Fees', 311, 376), item('Processing days', 428, 376), item('', 77, 358, true),
  item('Print-out of Grades', 77, 358), item('Clearance / Official', 194, 358, true), item('Receipt', 194, 343), item('₱', 311, 358), item('35.00', 318, 358), item('1', 428, 358), item('', 77, 325, true),
  item('Transcript of', 77, 261, true), item('Records', 77, 247), item('', 194, 261, true), item('Clearance / Official', 194, 261, true), item('Receipt', 194, 247),
  item('₱', 311, 261), item('150.00 for first two', 318, 261), item('', 311, 247, true), item('sheets; ₱35.00 for', 311, 247, true), item('every additional', 311, 233, true), item('sheet', 311, 219),
  item('7 (Tertiary Level)', 428, 261), item('', 77, 200, true),
  item('Diploma', 77, 200), item('Clearance', 194, 200), item('₱', 311, 200), item('350.00', 318, 200), item('1', 428, 200, true),
  item('Express or courier services are available on request for additional charge.', 72, 170, true),
]
const recordsRows = [
  ['Document', 'Requirements', 'Fees', 'Processing days'],
  ['Print-out of Grades', 'Clearance / Official Receipt', '₱35.00', '1'],
  ['Transcript of Records', 'Clearance / Official Receipt', '₱150.00 for first two sheets; ₱35.00 for every additional sheet', '7 (Tertiary Level)'],
  ['Diploma', 'Clearance', '₱350.00', '1'],
]

test('a table is rebuilt only when every cell is exactly the source text at its column and row', () => {
  const lines = topics.sourceLines([], true, [recordsLayout])
  const header = lines.find(l => l.text.startsWith('Document')).n
  const last = lines.find(l => l.text.startsWith('Diploma')).n
  const table = { startLine: header, endLine: last, rows: recordsRows, confident: true }
  const markdown = tables.verifyTable(lines, table)
  assert.equal(markdown, [
    '| Document | Requirements | Fees | Processing days |', '| --- | --- | --- | --- |',
    '| Print-out of Grades | Clearance / Official Receipt | ₱35.00 | 1 |',
    '| Transcript of Records | Clearance / Official Receipt | ₱150.00 for first two sheets; ₱35.00 for every additional sheet | 7 (Tertiary Level) |',
    '| Diploma | Clearance | ₱350.00 | 1 |',
  ].join('\n'))
  const swap = (rows, r, a, b) => rows.map((row, i) => i === r ? row.map((c, j) => j === a ? row[b] : j === b ? row[a] : c) : row)
  // A value in the wrong column, an invented value, a dropped value, a value in the wrong row, or an unsure model: kept as text.
  assert.equal(tables.verifyTable(lines, { ...table, rows: swap(recordsRows, 3, 2, 3) }), null)
  assert.equal(tables.verifyTable(lines, { ...table, rows: recordsRows.map((r, i) => i === 3 ? [...r.slice(0, 3), '2'] : r) }), null)
  assert.equal(tables.verifyTable(lines, { ...table, rows: recordsRows.slice(0, 3) }), null)
  assert.equal(tables.verifyTable(lines, { ...table, rows: recordsRows.map((r, i) => i === 1 ? [r[0], 'Clearance / Official', r[2], r[3]] : i === 2 ? [r[0], 'Receipt Clearance / Official Receipt', r[2], r[3]] : r) }), null)
  assert.equal(tables.verifyTable(lines, { ...table, confident: false }), null)
})

test('verified tables replace their source lines in the section; others stay as text and flag review', () => {
  const lines = topics.sourceLines([], true, [recordsLayout])
  const header = lines.find(l => l.text.startsWith('Document')).n
  const last = lines.find(l => l.text.startsWith('Diploma')).n
  const entries = [{ title: 'Request for Academic Records', level: 1, startLine: 1, heading: 'Request for Academic Records' }]
  const [good] = topics.topicsFromOutline(lines, entries, [], [{ startLine: header, endLine: last, rows: recordsRows, confident: true }])
  assert.match(good.content, /^Request for Academic Records\nThe requirements[^\n]*\n\| Document \| Requirements \| Fees \| Processing days \|\n/)
  assert.match(good.content, /\| Diploma \| Clearance \| ₱350\.00 \| 1 \|\nExpress or courier services are available on request for additional charge\.$/)
  assert.equal(good.tableReview, undefined)
  assert.equal(topics.topicReference(good).tableReview, undefined)
  const [unsure] = topics.topicsFromOutline(lines, entries, [], [{ startLine: header, endLine: last, rows: recordsRows, confident: false }])
  assert.equal(unsure.content, lines.map(l => l.text).join('\n'), 'source text kept as extracted')
  assert.equal(unsure.tableReview, true)
  assert.equal(topics.topicReference(unsure).tableReview, true)
})

test('section text splits into paragraphs and Markdown tables for rendering', () => {
  const text = ['Intro line', 'Second line', String.raw`| A | B \| C |`, '| --- | --- |', '| 1 | |', 'After the table.', '| not | a table |'].join('\n')
  const blocks = tables.textBlocks(text)
  assert.deepEqual(blocks, [
    { kind: 'text', text: 'Intro line\nSecond line' },
    { kind: 'table', header: ['A', 'B | C'], rows: [['1', '']] },
    { kind: 'text', text: 'After the table.\n| not | a table |' },
  ])
})

test('a table that continues on the next page is still verified in reading order', () => {
  const page4 = [item('Grade', 77, 172), item('Equivalent', 145, 172), item('Description', 216, 172, true), item('1.00', 77, 154), item('99', 145, 154), item('–', 159, 154), item('100', 165, 154), item('Excellent', 216, 154, true)]
  const page5 = [item('1.50', 77, 706), item('90', 145, 706), item('Satisfactory', 216, 706, true)]
  const lines = topics.sourceLines([], true, [page4, page5])
  const rows = [['Grade', 'Equivalent', 'Description'], ['1.00', '99–100', 'Excellent'], ['1.50', '90', 'Satisfactory']]
  assert.match(tables.verifyTable(lines, { startLine: 1, endLine: 3, rows, confident: true }), /\| 1\.50 \| 90 \| Satisfactory \|$/)
  assert.equal(tables.verifyTable(lines, { startLine: 1, endLine: 3, rows: [rows[0], rows[2], rows[1]], confident: true }), null, 'rows out of order')
})

// A section without the fields a reorder may change.
const withoutOrder = (guide) => Object.fromEntries(Object.entries(guide).filter(([key]) => key !== 'sort_order' && key !== 'updated_at'))
const byOrder = (state) => [...state.guides].sort((a, b) => a.sort_order - b.sort_order).map(g => g.title)

test('drag-and-drop order is saved without touching content, pages or status', async () => {
  const { state, db, createDraftGuides, reorderSourceSections } = database()
  await createDraftGuides(db, sourceId)
  assert.deepEqual(byOrder(state), ['Graduation Honors', 'Transfer', 'Leave of Absence'], 'first analysis follows the PDF')
  state.guides[1].status = 'published'
  const before = structuredClone(state.guides.map(withoutOrder))
  const reversed = [...state.guides].reverse().map(g => g.id)
  assert.deepEqual(await reorderSourceSections({ documentId: sourceId, ids: reversed }), { ok: true })
  assert.deepEqual(byOrder(state), ['Leave of Absence', 'Transfer', 'Graduation Honors'])
  assert.deepEqual(state.guides.map(withoutOrder), before)
  // Incomplete, duplicated or foreign lists are refused.
  for (const ids of [reversed.slice(1), [reversed[0], ...reversed.slice(0, 2)], [...reversed.slice(1), '62345678-1234-4234-8234-123456789abc']]) {
    assert.equal((await reorderSourceSections({ documentId: sourceId, ids })).ok, false)
  }
  assert.deepEqual(byOrder(state), ['Leave of Absence', 'Transfer', 'Graduation Honors'])
})

test('re-analysis keeps the admin order and places a new draft by the document structure', async () => {
  const { state, db, createDraftGuides, reorderSourceSections } = database()
  await createDraftGuides(db, sourceId)
  const id = (title) => state.guides.find(g => g.title === title).id
  await reorderSourceSections({ documentId: sourceId, ids: [id('Leave of Absence'), id('Graduation Honors'), id('Transfer')] })
  // The updated PDF has a new topic between Graduation Honors and Transfer.
  const shifting = { id: '12345678-1234-4234-8234-123456789ab9', chunk_index: 2, page_number: 3, section_title: 'Shifting', content: 'Shifting Students may shift programs once.', document_id: sourceId, metadata: {} }
  state.chunks = [state.chunks[0], state.chunks[1], shifting, { ...state.chunks[2], chunk_index: 3 }, { ...state.chunks[3], chunk_index: 4 }]
  const result = await createDraftGuides(db, sourceId)
  assert.equal(result.created, 1)
  assert.deepEqual(byOrder(state), ['Leave of Absence', 'Graduation Honors', 'Shifting', 'Transfer'])
})

test('re-analysis archives only unedited AI drafts whose topic left the PDF; edited drafts are kept', async () => {
  const { state, db, createDraftGuides } = database()
  await createDraftGuides(db, sourceId)
  const leave = state.guides.find(g => g.title === 'Leave of Absence')
  const transfer = state.guides.find(g => g.title === 'Transfer')
  // An admin edits the Transfer draft (saving drops the analysis fingerprint).
  Object.assign(transfer, { content: 'Admin-reviewed transfer text.', source_reference: JSON.stringify({ ...topics.readGuideReference(transfer.source_reference), contentHash: undefined }) })
  // The updated PDF no longer has Transfer or Leave of Absence.
  state.chunks = state.chunks.slice(0, 2)
  const result = await createDraftGuides(db, sourceId)
  assert.equal(result.archivedStale, 1); assert.equal(result.staleEdited, 1)
  assert.equal(leave.status, 'archived')
  assert.equal(transfer.status, 'draft'); assert.equal(transfer.content, 'Admin-reviewed transfer text.')
})
