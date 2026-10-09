import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const filename = path.join(root, 'lib/social-links.ts')
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
vm.runInThisContext(`(function(module,exports){${code}\n})`, { filename })(loaded, loaded.exports)
const { normalizeFacebookUrl, safeExternalUrl } = loaded.exports

test('blank links are optional', () => {
  assert.deepEqual(normalizeFacebookUrl('   '), { ok: true, url: null })
  assert.deepEqual(normalizeFacebookUrl(undefined), { ok: true, url: null })
})

test('Facebook links are trimmed and normalized to https://www.facebook.com', () => {
  assert.equal(normalizeFacebookUrl('  facebook.com/WUPCECT ').url, 'https://www.facebook.com/WUPCECT')
  assert.equal(normalizeFacebookUrl('http://m.facebook.com/WUPCECT').url, 'https://www.facebook.com/WUPCECT')
  assert.equal(normalizeFacebookUrl('https://fb.com/WUPCECT').url, 'https://www.facebook.com/WUPCECT')
  assert.equal(normalizeFacebookUrl('https://www.facebook.com/profile.php?id=123').url, 'https://www.facebook.com/profile.php?id=123')
})

test('other http(s) links are kept; invalid ones are rejected with a message', () => {
  assert.equal(normalizeFacebookUrl('https://example.edu/cect').url, 'https://example.edu/cect')
  for (const bad of ['javascript:alert(1)', 'not a link', 'ftp://example.edu/x']) {
    const result = normalizeFacebookUrl(bad)
    assert.equal(result.ok, false, bad)
    assert.ok(result.error)
  }
  assert.equal(safeExternalUrl('javascript:alert(1)'), null)
})
