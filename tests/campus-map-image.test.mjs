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

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
const OLD = 'campus-map/11111111-1111-4111-8111-111111111111.png'
const NEW = 'campus-map/22222222-2222-4222-8222-222222222222.png'

// Fake Supabase: a settings row, storage objects, and a record of every table written.
function setup({ current = OLD, files = {} } = {}) {
  const state = { settings: { id: true, campus_map_path: current, campus_map_mime_type: current ? 'image/png' : null }, files: { ...files }, removed: [], tablesWritten: [] }
  const db = {
    storage: {
      from: (bucket) => {
        assert.equal(bucket, 'documents')
        return {
          download: async (p) => (state.files[p] ? { data: new Blob([state.files[p]]), error: null } : { data: null, error: { message: 'not found' } }),
          remove: async (paths) => { state.removed.push(...paths); for (const p of paths) delete state.files[p]; return { error: null } },
        }
      },
    },
    from: (table) => {
      let values = null
      const q = {
        select: () => q, eq: () => q,
        update: (v) => { values = v; state.tablesWritten.push(table); return q },
        // A copy, like a real query result (not the stored row itself).
        maybeSingle: async () => { if (values) Object.assign(state.settings, values); return { data: values ? { id: true } : { ...state.settings }, error: null } },
        then: (resolve) => { if (values) Object.assign(state.settings, values); resolve({ error: null }) },
      }
      return q
    },
  }
  const actions = load('app/admin/campus-map/map-image-actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    '@/lib/auth': { requireAdmin: async () => ({ id: 'admin-1', role: 'admin' }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/sources': load('lib/sources.ts'),
  })
  return { state, ...actions }
}

test('uploading a map sets the Campus Map image reference and creates no Knowledge Library record', async () => {
  const { state, setCampusMapImage } = setup({ current: null, files: { [NEW]: PNG } })
  assert.deepEqual(await setCampusMapImage({ filePath: NEW, fileSize: PNG.length }), { ok: true })
  assert.equal(state.settings.campus_map_path, NEW)
  assert.equal(state.settings.campus_map_mime_type, 'image/png')
  assert.equal(state.settings.campus_map_updated_by, 'admin-1')
  assert.deepEqual(state.tablesWritten, ['system_settings'], 'only the settings reference is written: no documents row, no sections')
})

test('replacing the map swaps the image and removes only the previous map file', async () => {
  const { state, setCampusMapImage } = setup({ files: { [OLD]: PNG, [NEW]: PNG } })
  assert.deepEqual(await setCampusMapImage({ filePath: NEW, fileSize: PNG.length }), { ok: true })
  assert.equal(state.settings.campus_map_path, NEW)
  assert.deepEqual(state.removed, [OLD])
  assert.deepEqual(state.tablesWritten, ['system_settings'], 'buildings, locations and the legend are not touched')
})

test('a file that is not really an image is rejected and discarded; the current map stays', async () => {
  const { state, setCampusMapImage } = setup({ files: { [OLD]: PNG, [NEW]: new TextEncoder().encode('%PDF-1.4 not a map') } })
  const result = await setCampusMapImage({ filePath: NEW, fileSize: 18 })
  assert.equal(result.ok, false)
  assert.equal(state.settings.campus_map_path, OLD)
  assert.deepEqual(state.removed, [NEW])
})

test('only campus-map/ uploads are accepted (Knowledge Library files can never become the map)', async () => {
  const { state, setCampusMapImage } = setup()
  const result = await setCampusMapImage({ filePath: 'sources/22222222-2222-4222-8222-222222222222.png', fileSize: 16 })
  assert.equal(result.ok, false)
  assert.deepEqual(state.removed, [])
  assert.equal(state.settings.campus_map_path, OLD)
})

test('removing the map clears only the image; the directory is untouched', async () => {
  const { state, removeCampusMapImage } = setup({ files: { [OLD]: PNG } })
  assert.deepEqual(await removeCampusMapImage(), { ok: true })
  assert.equal(state.settings.campus_map_path, null)
  assert.deepEqual(state.removed, [OLD])
  assert.deepEqual(state.tablesWritten, ['system_settings'])
})
