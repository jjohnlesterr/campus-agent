import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const filename = path.join(root, 'lib/ai/public-scope.ts')
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
vm.runInThisContext(`(function(module,exports){${code}\n})`, { filename })(mod, mod.exports)
const { publicScopeReply, PERSONAL_RECORD_MESSAGE } = mod.exports

test('personal-record lookups get the fixed reply (Campus Agent has no access to records)', () => {
  for (const q of ['What are my grades?', "what's my GWA", 'Check my balance', 'show my schedule', 'Ano grades ko?', 'magkano balance ko', 'Did I pass Math 101?']) {
    assert.equal(publicScopeReply(q), PERSONAL_RECORD_MESSAGE, q)
  }
})

test('general policy topics are no longer blocked for guests', () => {
  for (const q of ['How do I fix an INC?', 'Paano ayusin INC ko?', "Dean's List requirements", 'cum laude requirements', 'graduation clearance steps',
    'How do I shift courses?', 'leave of absence', 'How do I drop a subject?', 'Paano kumuha ng TOR?', 'How do I request my transcript?', 'How do I get my class schedule?']) {
    assert.equal(publicScopeReply(q), null, q)
  }
})

test('freshman and visitor questions stay public', () => {
  for (const q of ['How do I apply for admission?', 'What are the freshman requirements?', 'Where is the Registrar?', 'What programs does CECT offer?',
    'When does enrollment start?', 'Where is the Accounting Office?', 'What documents do transferees need, like a transcript of records?',
    'Paano mag-apply bilang incoming freshman?', 'Ano ang dress code?', 'Are there upcoming campus events?']) {
    assert.equal(publicScopeReply(q), null, q)
  }
})
