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
const { publicScopeReply, STUDENT_ONLY_MESSAGE } = mod.exports

test('current-student questions get the sign-in reply on the public page', () => {
  for (const q of ['How do I fix an INC?', 'Paano ayusin INC ko?', 'What are my grades?', 'grades ko', 'I failed a subject', "Dean's List requirements",
    'cum laude requirements', 'graduation clearance steps', 'How do I shift courses?', 'leave of absence', 'How do I drop a subject?', 'Paano kumuha ng TOR?', 'transcript of records']) {
    assert.equal(publicScopeReply(q), STUDENT_ONLY_MESSAGE, q)
  }
})

test('applicant, freshman and visitor questions stay public', () => {
  for (const q of ['How do I enroll?', 'What are the admission requirements?', 'Where is the Registrar?', 'What programs are offered?',
    'When does enrollment start?', 'Where is the Accounting Office?', 'What documents do transferees need, like a transcript of records?',
    'Paano mag-apply bilang incoming freshman?', 'Ano ang dress code?', 'Where is the gym?']) {
    assert.equal(publicScopeReply(q), null, q)
  }
})
