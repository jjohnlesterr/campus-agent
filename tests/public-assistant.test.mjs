import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
function load(relative, mocks = {}) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => mocks[id], loaded, loaded.exports)
  return loaded.exports
}
const lm = load('lib/campus/location-match.ts')
const { detectProgramsQuestion } = load('lib/campus/programs-match.ts', { '@/lib/campus/location-match': lm })
const CODES = ['CAS', 'CAMS', 'CBA', 'CCJE', 'CECT', 'CHTM', 'COED', 'CON']

test('programs questions are recognized in English, Tagalog and Taglish', () => {
  assert.deepEqual(detectProgramsQuestion('What programs are offered?', CODES), { department: null })
  assert.deepEqual(detectProgramsQuestion('anong mga programs meron?', CODES), { department: null })
  assert.deepEqual(detectProgramsQuestion('Anong courses ang meron sa CECT?', CODES), { department: 'CECT' })
  assert.deepEqual(detectProgramsQuestion('CECT courses', CODES), { department: 'CECT' })
  assert.deepEqual(detectProgramsQuestion('What colleges are there?', CODES), { department: null })
})

test('procedure questions about programs go to the handbook instead', () => {
  for (const q of ['What are the requirements for BSIT?', 'Paano mag-shift ng course?', 'How do I enroll in a program?', 'Where is the CECT building?', 'How do I enroll?']) {
    assert.equal(detectProgramsQuestion(q, CODES), null, q)
  }
})

test('typo correction against legend words (public only)', () => {
  const vocab = new Set(['registrar', 'accounting', 'library', 'gymnasium', 'clinic', 'treasurer'])
  assert.deepEqual(lm.correctTypos(['registar'], vocab), ['registrar'])
  assert.deepEqual(lm.correctTypos(['acounting'], vocab), ['accounting'])
  assert.deepEqual(lm.correctTypos(['libary'], vocab), ['library'])
  assert.deepEqual(lm.correctTypos(['inc', 'tor', 'xyzzyq'], vocab), ['inc', 'tor', 'xyzzyq']) // short or unrelated words untouched
})

test('"san registar" finds the Registrar with fuzzy matching, not without', () => {
  const places = [{ building_number: 1, name: 'Registrar', building_name: 'Gloria D. Lacson Building', floor: 'L1', aliases: [] }]
  const mention = lm.detectPlaceMention('san registar', 'fil')
  assert.equal(lm.matchPlace(mention.target, places, new Map(), { exactOnly: true }).kind, 'none')
  assert.equal(lm.matchPlace(mention.target, places, new Map(), { exactOnly: true, fuzzy: true }).place.name, 'Registrar')
})
