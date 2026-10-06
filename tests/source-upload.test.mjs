import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const nodeRequire = createRequire(import.meta.url)
const testDirectory = path.dirname(fileURLToPath(import.meta.url))

// Load server modules without Next's request runtime; only auth/storage/DB are mocked.
function load(relative, mocks = {}) {
  const filename = path.resolve(testDirectory, '..', relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loadedModule = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    (id) => id in mocks ? mocks[id] : nodeRequire(id), loadedModule, loadedModule.exports,
  )
  return loadedModule.exports
}
const sources = load('lib/sources.ts')
const extract = load('lib/rag/extract.ts')
const chunk = load('lib/rag/chunk.ts')
const uploadPath = 'sources/12345678-1234-1234-1234-123456789abc.pdf'

function pdfFixture() {
  const texts = [
    ['ACADEMIC POLICIES', 'Students must submit enrollment requirements to the registrar before the semester begins.'],
    ['CAMPUS SERVICES', 'Students may visit the library during regular university hours for research and reference materials.'],
  ]
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>']
  for (let i = 0; i < texts.length; i++) {
    const stream = `BT /F1 12 Tf 40 700 Td (${texts[i][0]}) Tj 0 -24 Td (${texts[i][1]}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents ${4 + i * 2} 0 R >>`)
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let body = '%PDF-1.4\n', offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body))
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(body)
}

function database(options = {}) {
  const state = { doc: null, removed: [], chunks: [], updates: [], inserts: 0 }
  const blob = options.blob ?? new Blob([pdfFixture()], { type: sources.PDF })
  const db = {
    storage: { from: () => ({
      download: async () => ({ data: options.downloadError ? null : blob, error: options.downloadError ?? null }),
      remove: async paths => { state.removed.push(...paths); return { error: options.cleanupError ?? null } },
    }) },
    from: table => {
      let operation = 'select', value
      const query = {
        select() { return query }, eq() { return query }, neq() { return query }, in() { return query },
        insert(v) { operation = 'insert'; value = v; return query },
        update(v) { operation = 'update'; value = v; return query },
        delete() { operation = 'delete'; return query },
        single: async () => execute(), maybeSingle: async () => execute(),
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
      }
      function execute() {
        if (operation === 'select') return { data: state.doc, error: options.lookupError ?? null }
        if (operation === 'insert' && table === 'documents') {
          state.inserts++
          if (options.insertError) return { data: null, error: options.insertError }
          state.doc = { id: 'new-source', ...value }
          return { data: state.doc, error: null }
        }
        if (operation === 'insert') {
          if (options.chunkError) return { error: options.chunkError }
          state.chunks.push(...value)
        }
        if (operation === 'update') {
          state.updates.push(value.status)
          if (options.failStatus === value.status) return { data: null, error: { message: 'status rejected' } }
          Object.assign(state.doc, value)
          return { data: state.doc, error: null }
        }
        if (operation === 'delete') state.chunks = []
        return { data: null, error: null }
      }
      return query
    },
  }
  const ingest = load('lib/rag/ingest.ts', {
    'server-only': {}, '@/lib/rag/chunk': chunk, '@/lib/rag/extract': extract,
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/rag/embeddings': { embeddingsAvailable: () => false },
  })
  // Analysis is exercised here through its extraction step; draft creation and the
  // Claude overview are covered by knowledge-guides.test.mjs.
  const activeIngest = options.ingest ?? ingest
  const analyze = { analyzeSource: async (_db, id) => {
    const result = await activeIngest.ingestDocument(id)
    return result.ok ? { ok: true, pages: result.pages, created: 0, skipped: 0, overview: false } : result
  } }
  const actions = load('app/admin/documents/actions.ts', {
    'next/cache': { revalidatePath: () => {} }, 'next/navigation': { redirect: () => {} },
    '@/lib/auth': { requireAdmin: async () => { if (options.authError) throw new Error('Unauthorized') } },
    '@/lib/knowledge/analyze': analyze, '@/lib/sources': sources,
    '@/lib/supabase/server': { createClient: async () => db },
  })
  const input = { title: 'Upload test', sourceType: 'policy', visibility: 'public', filePath: uploadPath, fileName: 'test.pdf', fileSize: blob.size }
  return { state, input, ...actions }
}

const sourceId = '12345678-1234-4234-8234-123456789abc'

test('uploading a PDF only registers it: nothing is extracted until Analyze with AI', async () => {
  const { state, input, registerSource } = database()
  const result = await registerSource(input)
  assert.equal(result.ok, true)
  assert.equal(result.referenceOnly, false)
  assert.equal(state.doc.status, 'uploaded')
  assert.equal(state.chunks.length, 0)
  assert.deepEqual(state.updates, [])
})

test('Analyze with AI runs real extraction/chunking and stores page/section metadata before Ready', async () => {
  const { state, input, registerSource, analyzeDocument } = database()
  await registerSource(input)
  const result = await analyzeDocument(sourceId)
  assert.equal(result.ok, true)
  assert.equal(result.pages, 2)
  assert.deepEqual(state.updates, ['processing', 'ready'])
  assert.deepEqual(state.chunks.map(c => c.page_number), [1, 2])
  assert.deepEqual(state.chunks.map(c => c.section_title), ['ACADEMIC POLICIES', 'CAMPUS SERVICES'])
  assert.equal(state.chunks[0].metadata.page_count, 2)
  assert.equal(state.chunks[0].embedding, null)
})

test('PNG and JPEG sources under Other are Ready without extraction', async () => {
  for (const [bytes, mime, extension] of [
    [Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF2kAAAAASUVORK5CYII=', 'base64'), 'image/png', 'png'],
    [Buffer.from([255, 216, 255, 224, 0, 16]), 'image/jpeg', 'jpg'],
  ]) {
    const { state, input, registerSource } = database({ blob: new Blob([bytes]), ingest: { ingestDocument: () => { throw new Error('Images must not be processed') } } })
    const result = await registerSource({ ...input, sourceType: 'other', filePath: uploadPath.replace('.pdf', `.${extension}`), fileName: `test.${extension}` })
    assert.equal(result.ok, true)
    assert.equal(result.referenceOnly, true)
    assert.equal(state.doc.mime_type, mime)
    assert.equal(state.doc.status, 'ready')
    assert.equal(state.chunks.length, 0)
  }
})

test('a Campus Map PDF is a Ready reference file right away (the map page uses it)', async () => {
  const { state, input, registerSource } = database()
  const result = await registerSource({ ...input, sourceType: 'campus_map' })
  assert.equal(result.ok, true)
  assert.equal(state.doc.status, 'ready')
  assert.equal(state.chunks.length, 0)
})

test('analyzing a damaged PDF marks it failed and never reports success', async () => {
  const { state, input, registerSource, analyzeDocument } = database({ blob: new Blob(['%PDF-1.4\n%%EOF']) })
  assert.equal((await registerSource(input)).ok, true)
  const result = await analyzeDocument(sourceId)
  assert.equal(result.ok, false)
  assert.equal(state.doc.status, 'failed')
  assert.equal(state.chunks.length, 0)
  assert.deepEqual(state.removed, [])
})

for (const [name, options] of [
  ['missing Storage file', { downloadError: { message: 'not found' } }],
  ['failed database insert', { insertError: { message: 'RLS rejected insert' } }],
  ['invalid file signature', { blob: new Blob(['not a PDF']) }],
]) test(`${name} cannot report success and cleans the unregistered file`, async () => {
  const { state, input, registerSource } = database(options)
  const result = await registerSource(input)
  assert.equal(result.ok, false)
  assert.equal(state.doc, null)
  assert.deepEqual(state.removed, [uploadPath])
})

for (const [name, options] of [
  ['chunk persistence fails', { chunkError: { message: 'write failed' } }],
  ['Ready status update fails', { failStatus: 'ready' }],
  ['processing throws', { ingest: { ingestDocument: async () => { throw new Error('unexpected failure') } } }],
]) test(`${name} during analysis leaves a recoverable failed source, never success`, async () => {
  const { state, input, registerSource, analyzeDocument } = database(options)
  assert.equal((await registerSource(input)).ok, true)
  const result = await analyzeDocument(sourceId)
  assert.equal(result.ok, false)
  assert.equal(state.doc.status, 'failed')
  assert.deepEqual(state.removed, [])
})

test('cleanup cannot remove referenced files or the existing handbook path', async () => {
  const { state, input, registerSource, discardUnregisteredSource } = database()
  assert.equal((await registerSource(input)).ok, true)
  assert.equal(await discardUnregisteredSource(input.filePath), false)
  assert.equal(await discardUnregisteredSource('Information-WUP.pdf'), false)
  assert.deepEqual(state.removed, [])
  assert.equal((await registerSource(input)).ok, false)
  assert.equal(state.inserts, 1)
})

test('auth is still required for registration, analysis, archive, delete and cleanup', async () => {
  const { state, input, registerSource, discardUnregisteredSource, analyzeDocument, archiveDocument, deleteDocument } = database({ authError: true })
  await assert.rejects(registerSource(input), /Unauthorized/)
  await assert.rejects(analyzeDocument(sourceId), /Unauthorized/)
  await assert.rejects(archiveDocument(sourceId), /Unauthorized/)
  await assert.rejects(deleteDocument(sourceId), /Unauthorized/)
  await assert.rejects(discardUnregisteredSource(uploadPath), /Unauthorized/)
  assert.equal(state.inserts, 0)
  assert.deepEqual(state.removed, [])
})
