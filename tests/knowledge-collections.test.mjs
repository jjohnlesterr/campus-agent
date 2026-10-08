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

const collections = load('lib/knowledge/collections.ts')
const HANDBOOK = '11111111-1111-4111-8111-111111111111'
const ADMISSIONS = '22222222-2222-4222-8222-222222222222'
const WUP = '33333333-3333-4333-8333-333333333333'
const ENTRY = '44444444-4444-4444-8444-444444444444'

// Minimal in-memory Supabase query builder: enough for the collection actions.
function database(seed) {
  const tables = structuredClone(seed)
  const log = []
  return {
    tables, log,
    from(table) {
      let operation = 'select', values, head = false
      const filters = []
      const rows = () => (tables[table] ??= [])
      const query = {
        select(_columns, options) { head = !!options?.head; return query },
        order() { return query },
        eq(k, v) { filters.push((r) => r[k] === v); return query },
        neq(k, v) { filters.push((r) => r[k] !== v); return query },
        is(k, v) { filters.push((r) => (r[k] ?? null) === v); return query },
        insert(v) { operation = 'insert'; values = v; return query },
        update(v) { operation = 'update'; values = v; return query },
        delete() { operation = 'delete'; return query },
        single: async () => run(true), maybeSingle: async () => run(true),
        then(resolve, reject) { return Promise.resolve(run(false)).then(resolve, reject) },
      }
      function run(single) {
        const matched = rows().filter((r) => filters.every((f) => f(r)))
        if (operation === 'select') return head ? { count: matched.length, error: null } : { data: single ? matched[0] ?? null : matched, error: null }
        log.push({ table, operation, values: structuredClone(values ?? null), ids: matched.map((r) => r.id) })
        if (operation === 'insert') {
          if (table === 'knowledge_collections' && rows().some((r) => r.name.toLowerCase() === values.name.toLowerCase())) return { data: null, error: { code: '23505' } }
          const row = { id: `new-${rows().length + 1}`, ...values }
          rows().push(row)
          return { data: row, error: null }
        }
        if (operation === 'update') {
          for (const r of matched) Object.assign(r, values)
          return { data: single ? matched[0] ?? null : matched, error: null }
        }
        // delete: the database refuses deleting a referenced collection (on delete restrict).
        if (table === 'knowledge_collections' && matched.some((c) => [...(tables.documents ?? []), ...(tables.guidelines ?? [])].some((r) => r.collection_id === c.id))) {
          return { data: null, error: { code: '23503' } }
        }
        tables[table] = rows().filter((r) => !matched.includes(r))
        return { data: single ? matched[0] ?? null : matched, error: null }
      }
      return query
    },
  }
}

function loadActions(db, admin = true) {
  return load('app/admin/knowledge/collections/actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/auth': { requireAdmin: async () => { if (!admin) throw new Error('NEXT_REDIRECT') } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/knowledge/collections': collections,
    '@/lib/knowledge/source-order': load('lib/knowledge/source-order.ts', { 'server-only': {} }),
  })
}

const seed = () => ({
  knowledge_collections: [{ id: HANDBOOK, name: 'Student Handbook', description: 'Official handbook.', updated_at: '2026-10-08T00:00:00Z' }],
  documents: [{ id: WUP, title: 'Information WUP', collection_id: HANDBOOK, document_type: 'handbook', updated_at: '2026-10-08T01:00:00Z' }],
  guidelines: [{ id: ENTRY, title: 'Registrar hours', source_document_id: null, collection_id: null, status: 'published', updated_at: '2026-10-07T00:00:00Z' }],
})

test('collection summaries count sources and sections, and keep ungrouped data under Uncategorized', () => {
  const summaries = collections.summarizeCollections(
    [{ id: HANDBOOK, name: 'Student Handbook', description: null, updated_at: '2026-10-01T00:00:00Z' }, { id: ADMISSIONS, name: 'Admissions', description: null, updated_at: '2026-10-02T00:00:00Z' }],
    [{ id: WUP, collection_id: HANDBOOK, updated_at: '2026-10-05T00:00:00Z' }, { id: 'legacy', collection_id: null, updated_at: '2026-10-03T00:00:00Z' }],
    [
      ...Array.from({ length: 18 }, () => ({ source_document_id: WUP, collection_id: null, status: 'published', updated_at: '2026-10-08T00:00:00Z' })),
      { source_document_id: WUP, collection_id: null, status: 'draft', updated_at: '2026-10-04T00:00:00Z' },
      { source_document_id: null, collection_id: null, status: 'draft', updated_at: '2026-10-06T00:00:00Z' },
      // Sections of sources outside the library (campus map) are ignored.
      { source_document_id: 'campus-map', collection_id: null, status: 'published', updated_at: '2026-10-09T00:00:00Z' },
    ],
  )
  assert.deepEqual(summaries.map((s) => s.name), ['Admissions', 'Student Handbook', 'Uncategorized'])
  const handbook = summaries.find((s) => s.id === HANDBOOK)
  assert.equal(handbook.sources, 1)
  assert.equal(handbook.published, 18)
  assert.equal(handbook.drafts, 1)
  assert.equal(handbook.updatedAt, '2026-10-08T00:00:00Z')
  const uncategorized = summaries.at(-1)
  assert.equal(uncategorized.id, collections.UNCATEGORIZED)
  assert.equal(uncategorized.sources, 2, 'legacy upload + manual entry')
  assert.equal(summaries.find((s) => s.id === ADMISSIONS).sources, 0)
})

test('Uncategorized is omitted when everything is in a collection', () => {
  const summaries = collections.summarizeCollections([{ id: HANDBOOK, name: 'Student Handbook', description: null, updated_at: '2026-10-01T00:00:00Z' }], [{ id: WUP, collection_id: HANDBOOK, updated_at: '2026-10-05T00:00:00Z' }], [])
  assert.deepEqual(summaries.map((s) => s.id), [HANDBOOK])
})

test('collection route ids and search', () => {
  assert.equal(collections.parseCollectionId('uncategorized'), 'uncategorized')
  assert.equal(collections.parseCollectionId(HANDBOOK.toUpperCase()), HANDBOOK)
  assert.equal(collections.parseCollectionId('../etc'), null)
  assert.equal(collections.collectionHref(null), '/admin/knowledge/collections/uncategorized')
  const list = [{ id: HANDBOOK, name: 'Student Handbook', description: 'Academic rules' }, { id: ADMISSIONS, name: 'Admissions', description: null }]
  assert.deepEqual(collections.filterCollections(list, 'academic').map((c) => c.id), [HANDBOOK])
  assert.equal(collections.filterCollections(list, '  ').length, 2)
})

test('creating a collection stores name and optional description; duplicate names are refused', async () => {
  const db = database(seed())
  const { createCollection } = loadActions(db)
  const created = await createCollection({ name: '  Admissions ', description: '' })
  assert.equal(created.ok, true)
  assert.deepEqual(db.tables.knowledge_collections.at(-1), { id: created.id, name: 'Admissions', description: null })
  const duplicate = await createCollection({ name: 'student handbook', description: '' })
  assert.deepEqual(duplicate, { ok: false, error: 'A collection with this name already exists.' })
  assert.equal((await createCollection({ name: 'A', description: '' })).ok, false)
})

test('moving a source or manual entry changes only its collection (and the source position in it), never duplicating it', async () => {
  const db = database({ ...seed(), knowledge_collections: [...seed().knowledge_collections, { id: ADMISSIONS, name: 'Admissions', description: null }] })
  const { moveToCollection } = loadActions(db)
  assert.deepEqual(await moveToCollection({ kind: 'source', id: WUP, collectionId: ADMISSIONS }), { ok: true })
  assert.deepEqual(await moveToCollection({ kind: 'manual', id: ENTRY, collectionId: HANDBOOK }), { ok: true })
  assert.deepEqual(db.log.map((l) => [l.table, l.operation, l.values]), [
    // A moved source goes to the end of its new collection.
    ['documents', 'update', { collection_id: ADMISSIONS, sort_order: 1 }],
    ['guidelines', 'update', { collection_id: HANDBOOK }],
  ])
  assert.equal(db.tables.documents.length, 1)
  assert.equal(db.tables.guidelines.length, 1)
  assert.equal(db.tables.documents[0].collection_id, ADMISSIONS)
  // Back to Uncategorized.
  assert.deepEqual(await moveToCollection({ kind: 'source', id: WUP, collectionId: null }), { ok: true })
  assert.equal(db.tables.documents[0].collection_id, null)
  assert.equal((await moveToCollection({ kind: 'source', id: 'not-a-uuid', collectionId: null })).ok, false)
})

test('a collection with sources cannot be deleted; an empty one can', async () => {
  const db = database(seed())
  const { deleteCollection, moveToCollection } = loadActions(db)
  const refused = await deleteCollection(HANDBOOK)
  assert.deepEqual(refused, { ok: false, error: 'This collection contains 1 source. Move it to another collection before deleting the collection.' })
  assert.equal(db.tables.knowledge_collections.length, 1)
  assert.equal(db.tables.documents.length, 1, 'knowledge is never cascaded away')
  assert.equal(db.log.some((l) => l.operation === 'delete'), false)

  await moveToCollection({ kind: 'source', id: WUP, collectionId: null })
  assert.deepEqual(await deleteCollection(HANDBOOK), { ok: true })
  assert.equal(db.tables.knowledge_collections.length, 0)
  assert.equal(db.tables.documents.length, 1)
})

test('only admins can manage collections', async () => {
  const db = database(seed())
  const actions = loadActions(db, false)
  await assert.rejects(actions.createCollection({ name: 'Scholarships', description: '' }))
  await assert.rejects(actions.moveToCollection({ kind: 'source', id: WUP, collectionId: null }))
  await assert.rejects(actions.deleteCollection(HANDBOOK))
  assert.equal(db.log.length, 0)
})

test('uploads and text sources are assigned to the collection they were created in', () => {
  const documents = fs.readFileSync(path.join(root, 'app/admin/documents/actions.ts'), 'utf8')
  assert.match(documents, /collectionId: z\.uuid\(\)\.nullable\(\)\.default\(null\)/)
  assert.match(documents, /collection_id: collectionId,/)
  assert.match(documents, /collection_id: collectionId \|\| null/)
})

test('the migration preserves existing data and leaves retrieval untouched', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261008050950_knowledge_collections.sql'), 'utf8')
  assert.doesNotMatch(migration, /\bdrop\b|\bdelete\s+from\b|\btruncate\b|on delete cascade|search_knowledge\s*\(/i)
  assert.doesNotMatch(migration, /parent_id/i, 'collections are one level only')
  assert.match(migration, /on delete restrict/)
  assert.match(migration, /add column collection_id uuid references public\.knowledge_collections/)
  // Campus Agent search does not filter by collection.
  for (const file of ['lib/rag/search.ts', 'lib/ai/campus-agent.ts']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /collection/i, file)
  }
})

const A = '55555555-5555-4555-8555-555555555551'
const B = '55555555-5555-4555-8555-555555555552'
const MAP = '55555555-5555-4555-8555-555555555553'
const reorderSeed = () => ({
  ...seed(),
  documents: [
    { id: WUP, title: 'Information WUP', collection_id: HANDBOOK, document_type: 'handbook', sort_order: 1, updated_at: '2026-10-08T01:00:00Z' },
    { id: A, title: 'Section 1', collection_id: HANDBOOK, document_type: 'handbook', sort_order: 2, updated_at: '2026-10-08T02:00:00Z' },
    { id: B, title: 'Section 2', collection_id: HANDBOOK, document_type: 'handbook', sort_order: 3, updated_at: '2026-10-08T03:00:00Z' },
    { id: MAP, title: 'Campus map', collection_id: HANDBOOK, document_type: 'campus_map', sort_order: null, updated_at: '2026-10-08T04:00:00Z' },
  ],
})

test('reordering source cards saves only sort_order, for every source of the collection', async () => {
  const db = database(reorderSeed())
  const { reorderCollectionSources } = loadActions(db)
  const before = structuredClone(db.tables.documents)
  assert.deepEqual(await reorderCollectionSources({ collectionId: HANDBOOK, ids: [B, WUP, A] }), { ok: true })
  const order = (id) => db.tables.documents.find((d) => d.id === id).sort_order
  assert.deepEqual([order(B), order(WUP), order(A)], [1, 2, 3])
  assert(db.log.every((l) => l.table === 'documents' && l.operation === 'update' && Object.keys(l.values).join() === 'sort_order'))
  const strip = (rows) => rows.map(({ sort_order, ...rest }) => (void sort_order, rest))
  assert.deepEqual(strip(db.tables.documents), strip(before), 'titles, files and statuses are unchanged')
  // A partial, duplicated or foreign list is refused (the campus map is never part of it).
  for (const ids of [[B, WUP], [B, WUP, A, A], [B, WUP, MAP], [B, WUP, A, ENTRY]]) {
    assert.equal((await reorderCollectionSources({ collectionId: HANDBOOK, ids })).ok, false)
  }
  assert.equal((await loadActions(db, false).reorderCollectionSources({ collectionId: HANDBOOK, ids: [A] }).catch(() => ({ ok: false }))).ok, false, 'admins only')
})

test('a source moved into a collection goes to its end', async () => {
  const db = database({ ...reorderSeed(), knowledge_collections: [...seed().knowledge_collections, { id: ADMISSIONS, name: 'Admissions', description: null }] })
  const { moveToCollection } = loadActions(db)
  await moveToCollection({ kind: 'source', id: A, collectionId: ADMISSIONS })
  await moveToCollection({ kind: 'source', id: B, collectionId: ADMISSIONS })
  assert.deepEqual(db.tables.documents.filter((d) => d.collection_id === ADMISSIONS).map((d) => [d.id, d.sort_order]), [[A, 1], [B, 2]])
})
