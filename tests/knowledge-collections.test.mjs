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

test('moving a source or manual entry only changes collection_id and never duplicates it', async () => {
  const db = database({ ...seed(), knowledge_collections: [...seed().knowledge_collections, { id: ADMISSIONS, name: 'Admissions', description: null }] })
  const { moveToCollection } = loadActions(db)
  assert.deepEqual(await moveToCollection({ kind: 'source', id: WUP, collectionId: ADMISSIONS }), { ok: true })
  assert.deepEqual(await moveToCollection({ kind: 'manual', id: ENTRY, collectionId: HANDBOOK }), { ok: true })
  assert.deepEqual(db.log.map((l) => [l.table, l.operation, l.values]), [
    ['documents', 'update', { collection_id: ADMISSIONS }],
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

test('uploads and manual entries are assigned to the collection they were created in', () => {
  const documents = fs.readFileSync(path.join(root, 'app/admin/documents/actions.ts'), 'utf8')
  assert.match(documents, /collectionId: z\.uuid\(\)\.nullable\(\)\.default\(null\)/)
  assert.match(documents, /collection_id: collectionId/)
  const knowledge = fs.readFileSync(path.join(root, 'app/admin/knowledge/actions.ts'), 'utf8')
  assert.match(knowledge, /collection_id: values\.collectionId \|\| null/)
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
