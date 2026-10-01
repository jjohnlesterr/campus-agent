import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
function load(relative) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(module,exports){${code}\n})`, { filename })(loaded, loaded.exports)
  return loaded.exports
}
const { programsForDepartment } = load('lib/programs.ts')

const CECT = 'cect', CAS = 'cas', CON = 'con'
const programs = [
  { id: '1', code: 'BSIT', department_id: CECT },
  { id: '2', code: 'BSCPE', department_id: CECT },
  { id: '3', code: 'BSECE', department_id: CECT },
  { id: '4', code: 'BS Psychology', department_id: CAS },
]

test('a department only offers its own programs', () => {
  assert.deepEqual(programsForDepartment(programs, CECT).map(p => p.code), ['BSIT', 'BSCPE', 'BSECE'])
  assert.deepEqual(programsForDepartment(programs, CAS).map(p => p.code), ['BS Psychology'])
})

test('departments without verified programs offer none', () => {
  assert.deepEqual(programsForDepartment(programs, CON), [])
})

test('no department selected offers no programs', () => {
  assert.deepEqual(programsForDepartment(programs, ''), [])
  assert.deepEqual(programsForDepartment(programs, null), [])
})
