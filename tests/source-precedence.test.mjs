// Real database/RLS checks for designated-source retrieval. All fixtures are local;
// no Supabase writes, API keys, model calls, or remote migrations.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import ts from 'typescript'
import { asRole, migratedDb } from './support/migrated-db.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const nodeRequire = createRequire(import.meta.url)
function load(relative, mocks = {}) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => id in mocks ? mocks[id] : nodeRequire(id), loaded, loaded.exports)
  return loaded.exports
}
const registry = load('lib/knowledge/source-precedence.ts')
const FAQ = registry.SOURCE_UPDATES[0].sourceId
const OTHER = '00000000-0000-4000-8000-00000000a002'
const topics = load('lib/knowledge/topics.ts', { '@/lib/knowledge/tables': load('lib/knowledge/tables.ts'), '@/lib/rag/extract': {} })
const { designatedUpdatePassages } = load('lib/rag/search.ts', {
  'server-only': {},
  '@/lib/knowledge/source-precedence': registry,
  '@/lib/knowledge/topics': topics,
  '@/lib/supabase/server': { createClient: async () => { throw Error('must use caller client') } },
})

let db, category
const fixtureIds = []
before(async () => {
  db = await migratedDb()
  category = (await db.query('select id from public.guideline_categories limit 1')).rows[0].id
  await db.query("insert into public.documents (id,title,status,visibility,mime_type,file_path,file_name,file_size) values ($1,'Renamed FAQ','ready','public','text/plain','faq.txt','unrelated-name.txt',10),($2,'CECT Agent — Frequently Asked Questions and University Information','ready','public','text/plain','other.txt','faq-newest.txt',10)", [FAQ, OTHER])
})
after(async () => { await db?.close() })

// Minimal PostgREST query adapter. Filters, ranges and RLS execute in real SQL.
function client(role = 'anon') {
  return { from(table) {
    assert.ok(['documents', 'guidelines'].includes(table))
    const values = [], where = []
    let start = 0, count = 1000
    const field = (column) => { assert.match(column, /^[a-z_]+$/); return column }
    const query = {
      select() { return query },
      in(column, list) { values.push(list); where.push(`${field(column)} = any($${values.length}::uuid[])`); return query },
      eq(column, value) { values.push(value); where.push(`${field(column)}::text = $${values.length}`); return query },
      neq(column, value) { values.push(value); where.push(`${field(column)}::text <> $${values.length}`); return query },
      order(column) { assert.equal(column, 'id'); return query },
      range(a, b) { start = a; count = b - a + 1; return query },
      then(resolve, reject) {
        return asRole(db, role, async () => {
          const { rows } = await db.query(`select * from public.${table} where ${where.join(' and ')} order by id limit ${count} offset ${start}`, values)
          return { data: rows, error: null }
        }).then(resolve, reject)
      },
    }
    return query
  } }
}
async function section(title, content, { sourceId = FAQ, status = 'published', visibility = 'public', pages = [2, 3] } = {}) {
  const { rows } = await db.query('insert into public.guidelines (title,slug,content,source_document_id,status,visibility,category_id,source_reference) values ($1,gen_random_uuid()::text,$2,$3,$4,$5,$6,$7) returning id', [title, content, sourceId, status, visibility, category, JSON.stringify({ version: 1, topic: title, chunkIds: [], pages })])
  fixtureIds.push(rows[0].id)
  return rows[0].id
}
async function clear() {
  await db.query('delete from public.guidelines where id = any($1::uuid[])', [fixtureIds.splice(0)])
}

test('designation follows immutable ID despite renaming; a newer same-title upload gains no authority', async () => {
  await section('COG', 'Pay ₱100, then request COG at the Registrar.')
  await section('COG newer duplicate', 'Different fee.', { sourceId: OTHER })
  const found = await designatedUpdatePassages(client())
  assert.equal(found.length, 1)
  assert.equal(found[0].documentTitle, 'Renamed FAQ')
  assert.equal(found[0].sourceLabel, 'Renamed FAQ — Pages 2, 3')
  assert.equal(found[0].pageNumber, 2)
  assert.equal(found[0].sectionTitle, 'COG')
  await clear()
})

test('Draft and Archived sections are never considered, including for signed-in callers', async () => {
  await section('Live', 'Published information.')
  await section('Draft', 'Unreviewed fee.', { status: 'draft' })
  await section('Archived', 'Old fee.', { status: 'archived' })
  for (const role of ['anon', 'authenticated']) {
    assert.deepEqual((await designatedUpdatePassages(client(role))).map(p => p.sectionTitle), ['Live'])
  }
  await clear()
})

test('anonymous callers cannot see sign-in-only sections; authenticated callers can', async () => {
  await section('Internal', 'Internal information.', { visibility: 'authenticated' })
  assert.equal((await designatedUpdatePassages(client())).length, 0)
  assert.equal((await designatedUpdatePassages(client('authenticated'))).length, 1)
  await clear()
})

test('unpublishing, archiving a source, or deleting it removes authority without stale cached passages', async () => {
  const id = await section('Live', 'Current instructions.')
  assert.equal((await designatedUpdatePassages(client())).length, 1)
  await db.query("update public.guidelines set status='draft' where id=$1", [id])
  assert.equal((await designatedUpdatePassages(client())).length, 0)
  await db.query("update public.guidelines set status='published' where id=$1", [id])
  await db.query("update public.documents set status='archived' where id=$1", [FAQ])
  assert.equal((await designatedUpdatePassages(client())).length, 0)
  await db.query("update public.documents set status='ready' where id=$1", [FAQ])
  assert.equal((await designatedUpdatePassages(client())).length, 1)
  await clear()
  assert.equal((await designatedUpdatePassages(client())).length, 0)
})

test('unpaged updates cite their section, and empty sections never establish coverage', async () => {
  await section('Student ID replacement', 'Visit OSA.', { pages: [] })
  await section('Empty', '', { pages: [] })
  const found = await designatedUpdatePassages(client())
  assert.equal(found.length, 1)
  assert.equal(found[0].sourceLabel, 'Renamed FAQ — Student ID replacement')
  assert.equal(found[0].pageNumber, null)
  await clear()
})

test('source updates beyond the first API page are retained independently of full-text rank', async () => {
  for (let i = 0; i < 101; i++) await section(`Section ${i}`, `Supported fact ${i}.`)
  assert.equal((await designatedUpdatePassages(client())).length, 101)
  await clear()
})

test('retrieval failures surface instead of silently serving potentially superseded guidance', async () => {
  const failed = { from: () => ({ select: () => ({ in: () => ({ neq: async () => ({ data: null, error: { message: 'offline' } }) }) }) }) }
  await assert.rejects(designatedUpdatePassages(failed), /Source update lookup failed: offline/)
})
