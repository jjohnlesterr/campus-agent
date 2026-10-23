// search_knowledge against a real Postgres (PGlite) with every migration applied.
// Synthetic fixtures only; nothing connects to Supabase.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { after, before, test } from 'node:test'
import { applyMigration, asRole, migratedDb } from './support/migrated-db.mjs'

const SOURCE_TITLES = '20261023120000_search_knowledge_source_titles.sql'
const ROLLBACK = new URL('../supabase/rollbacks/20261023120000_search_knowledge_source_titles.down.sql', import.meta.url)

let db
let ids = 0
const uuid = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`

async function category() {
  const { rows } = await db.query("select id from public.guideline_categories order by sort_order limit 1")
  return rows[0].id
}

async function source(title, { status = 'ready', visibility = 'public', referenceLabel = null } = {}) {
  const id = uuid()
  await db.query(
    "insert into public.documents (id, title, status, visibility, reference_label, mime_type, file_path, file_name, file_size) values ($1, $2, $3, $4, $5, 'text/plain', $6, 'source.txt', 10)",
    [id, title, status, visibility, referenceLabel, `test/${id}.txt`],
  )
  return id
}

async function section(title, content, { sourceId = null, status = 'published', visibility = 'public' } = {}) {
  const id = uuid()
  await db.query(
    'insert into public.guidelines (id, title, slug, content, source_document_id, status, visibility, category_id) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, title, `test-${id}`, content, sourceId, status, visibility, await category()],
  )
  return id
}

/** search_knowledge exactly as the app calls it (RPC under the caller's role). */
async function search(query, { role = 'anon', limit = 5, on = db } = {}) {
  return asRole(on, role, async () => (await on.query('select section_id, title, source_title, rank from public.search_knowledge($1, $2)', [query, limit])).rows)
}

async function functionInfo(on) {
  const { rows } = await on.query(`
    select p.prosecdef as security_definer, p.proconfig as config, pg_get_function_identity_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as result,
           has_function_privilege('anon', p.oid, 'execute') as anon_exec,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_knowledge'`)
  return rows[0]
}

before(async () => { db = await migratedDb() })
after(async () => { await db?.close() })

test('the migration keeps the function contract: same signature and result, security invoker, empty search_path, anon/authenticated execute', async () => {
  const previous = await migratedDb({ until: SOURCE_TITLES })
  try {
    const [old, current] = [await functionInfo(previous), await functionInfo(db)]
    assert.deepEqual(current, old)
    assert.equal(current.security_definer, false)
    assert.deepEqual(current.config, ['search_path=""'])
    assert.equal(current.anon_exec, true)
    assert.equal(current.auth_exec, true)
  } finally {
    await previous.close()
  }
})

test('a section is found by its source title even when its own text never repeats it', async () => {
  const recipe = await source('Adobong Manok Recipe')
  const ingredients = await section('Ingredients', 'Chicken, soy sauce, vinegar, garlic, pepper and bay leaves.', { sourceId: recipe })
  const steps = await section('Steps', 'Marinate the chicken, then simmer it for 40 minutes.', { sourceId: recipe })
  const hits = await search('adobong manok')
  assert.deepEqual(hits.map((h) => h.section_id).sort(), [ingredients, steps].sort())
  assert.ok(hits.every((h) => h.source_title === 'Adobong Manok Recipe'))
  // The section whose own text matches more of the question ranks first.
  assert.equal((await search('adobong manok ingredients soy sauce'))[0].section_id, ingredients)
})

test('the reference label is part of the searchable source title', async () => {
  const memo = await source('Enrollment clarification', { referenceLabel: 'Registrar memo 2026-07' })
  const id = await section('Late enrollment', 'Late enrollment closes one week after classes start.', { sourceId: memo })
  assert.ok((await search('registrar memo')).some((h) => h.section_id === id))
})

test('editing a section updates what it is found by (no stale terms)', async () => {
  const src = await source('Library Guide')
  const id = await section('Opening hours', 'The library opens at 8:00 AM.', { sourceId: src })
  assert.ok((await search('opens 8:00')).some((h) => h.section_id === id))
  await db.query("update public.guidelines set title = 'Borrowing', content = 'Students may borrow three books at a time.' where id = $1", [id])
  assert.ok((await search('borrow books')).some((h) => h.section_id === id))
  assert.ok(!(await search('opening hours opens')).some((h) => h.section_id === id))
})

test('Draft, unpublished and archived sections are never returned, to anyone', async () => {
  const src = await source('Zeta Scholarship Handout')
  const draft = await section('Draft scholarship', 'Scholarship zeta requirements.', { sourceId: src, status: 'draft' })
  const archived = await section('Archived scholarship', 'Scholarship zeta requirements.', { sourceId: src, status: 'archived' })
  const live = await section('Scholarship zeta', 'Scholarship zeta requirements.', { sourceId: src })
  for (const role of ['anon', 'authenticated']) {
    const found = (await search('scholarship zeta', { role })).map((h) => h.section_id)
    assert.ok(found.includes(live))
    assert.ok(!found.includes(draft) && !found.includes(archived))
  }
  await db.query("update public.guidelines set status = 'draft' where id = $1", [live]) // unpublish
  assert.equal((await search('scholarship zeta')).length, 0)
  assert.equal((await search('zeta handout')).length, 0) // its source title no longer finds it either
})

test('sections of an archived source are not returned, and the archived title adds no matches', async () => {
  const src = await source('Omega Retreat Policy')
  const id = await section('Retreat schedule', 'Retreats run every March.', { sourceId: src })
  assert.ok((await search('omega retreat')).some((h) => h.section_id === id))
  await db.query("update public.documents set status = 'archived' where id = $1", [src])
  assert.equal((await search('omega retreat')).length, 0)
  assert.equal((await search('retreats march')).length, 0)
})

test('sign-in-only sections are hidden from public visitors but found for signed-in users', async () => {
  const src = await source('Internal Kappa Procedures')
  const id = await section('Kappa clearance', 'Kappa clearance is signed by the dean.', { sourceId: src, visibility: 'authenticated' })
  assert.ok(!(await search('kappa clearance')).some((h) => h.section_id === id))
  assert.ok((await search('kappa clearance', { role: 'authenticated' })).some((h) => h.section_id === id))
})

test('irrelevant questions match nothing, and a shared source-title word never outranks a section that answers', async () => {
  assert.equal((await search('quantum chromodynamics lattice')).length, 0)
  const handbook = await source('Student Handbook Sigma')
  const answer = await section('Sigma uniform policy', 'The sigma uniform is worn Monday to Thursday.', { sourceId: handbook })
  await section('Sigma parking', 'Parking permits are issued by security.', { sourceId: handbook })
  const hits = await search('sigma uniform')
  assert.equal(hits[0].section_id, answer)
  assert.ok(hits[0].rank > hits[1].rank)
})

test('manual entries (no source) are searched exactly as before', async () => {
  const id = await section('Lambda shuttle schedule', 'The lambda shuttle leaves every hour.')
  const hits = await search('lambda shuttle')
  assert.equal(hits[0].section_id, id)
  assert.equal(hits[0].source_title, null)
})

test('the rollback restores the previous search exactly (no source-title matches), with the same contract', async () => {
  const rolledBack = await migratedDb()
  const reference = await migratedDb({ until: SOURCE_TITLES })
  try {
    await rolledBack.exec(fs.readFileSync(ROLLBACK, 'utf8'))
    assert.deepEqual(await functionInfo(rolledBack), await functionInfo(reference))
    const definition = async (on) => (await on.query("select pg_get_functiondef('public.search_knowledge(text, integer)'::regprocedure) as d")).rows[0].d
    assert.equal(await definition(rolledBack), await definition(reference))
    // Re-applying the migration after a rollback works (idempotent create or replace).
    await applyMigration(rolledBack, SOURCE_TITLES)
    assert.equal(await definition(rolledBack), await definition(db))
  } finally {
    await rolledBack.close()
    await reference.close()
  }
})
