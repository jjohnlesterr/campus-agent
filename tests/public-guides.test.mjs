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
function load(relative) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(nodeRequire, loaded, loaded.exports)
  return loaded.exports
}

const { listPublishedGuides, getPublishedGuide } = load('lib/knowledge/guides.ts')

// Query-builder stand-in that records every filter applied to `guidelines`.
function fakeDb() {
  const filters = []
  let table
  const q = {
    select: () => q,
    eq: (col, val) => (filters.push(`${col}=${val}`), q),
    order: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
  }
  return { db: { from: (t) => ((table = t), q) }, filters, table: () => table }
}

test('the public guide list asks only for Published, public guides', async () => {
  const { db, filters, table } = fakeDb()
  await listPublishedGuides(db, { publicOnly: true })
  assert.equal(table(), 'guidelines')
  assert.deepEqual(filters.sort(), ['status=published', 'visibility=public'])
})

test('a public guide is looked up by id and must be Published and public (drafts and archived are never returned)', async () => {
  const { db, filters } = fakeDb()
  await getPublishedGuide(db, 'g1', { publicOnly: true })
  assert.deepEqual(filters.sort(), ['id=g1', 'status=published', 'visibility=public'])
})

test('the signed-in Guides section still only shows Published guides', async () => {
  const list = fakeDb()
  await listPublishedGuides(list.db)
  assert.deepEqual(list.filters, ['status=published'])
  const one = fakeDb()
  await getPublishedGuide(one.db, 'g1')
  assert.deepEqual(one.filters.sort(), ['id=g1', 'status=published'])
})

test('public guide pages use the anonymous client and require no sign-in', () => {
  for (const file of ['app/guides/page.tsx', 'app/guides/[id]/page.tsx']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(src, /createPublicClient\(\)/, file)
    assert.match(src, /publicOnly: true/, file)
    assert.doesNotMatch(src, /requireProfile|requireAdmin|lib\/supabase\/server/, file)
  }
})
