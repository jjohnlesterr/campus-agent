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
const locationMatch = load('lib/campus/location-match.ts')
const { classifyMessage, LOCAL_RESPONSES } = load('lib/ai/guardrail.ts', { '@/lib/campus/location-match': locationMatch })

const local = (message, category) => {
  const r = classifyMessage(message)
  assert.equal(r.handledLocally, true, `"${message}" should be answered locally (got ${r.category})`)
  assert.equal(r.category, category, `"${message}"`)
  return r
}
const passes = (message) => {
  const r = classifyMessage(message)
  assert.equal(r.handledLocally, false, `"${message}" must reach the normal pipeline (got ${r.category})`)
}

test('required local cases never reach Claude', () => {
  assert.equal(local('hi', 'greeting').response, LOCAL_RESPONSES.greeting)
  local('hello po', 'greeting')
  local('ano kaya', 'help')
  local('asdjkhaskjdh', 'nonsense')
  local('tangina mo', 'abusive')
  local('you are stupid', 'abusive')
  local('tell me a joke about cats', 'abusive')
  local('who won the NBA?', 'off_topic')
})

test('greetings, thanks and help in English, Tagalog and Taglish', () => {
  for (const m of ['Hello!', 'good morning', 'Magandang umaga po', 'kumusta', 'hi Campus Agent', 'ok sige']) local(m, 'greeting')
  assert.equal(local('thank you so much', 'greeting').response, LOCAL_RESPONSES.thanks)
  assert.equal(local('salamat po', 'greeting').response, LOCAL_RESPONSES.thanks)
  for (const m of ['help', 'What can you do?', 'who are you', 'Ano pwede itanong?', 'anong kaya mo', 'What is Campus Agent?']) local(m, 'help')
})

test('gibberish and fillers', () => {
  for (const m of ['qwrtypsdfg', 'hjkl hjkl', '???', '....', 'hahaha', 'hmmm', 'lol']) local(m, 'nonsense')
})

test('clearly unrelated requests', () => {
  for (const m of ["what's the weather tomorrow", 'give me a recipe for adobo', 'write me a poem', 'capital of France']) local(m, 'off_topic')
})

test('required campus questions pass through', () => {
  for (const m of ['Nasaan registrar?', 'Paano INC?', 'kuha TOR', 'May event ba CECT?', 'Ano dress code?', 'How do I enroll?', 'Where is the gym?']) passes(m)
})

test('Tagalog / Taglish campus questions pass through', () => {
  for (const m of [
    'Nasaan yung Registrar?', 'Paano ayusin INC ko?', 'Ano requirements sa enrollment?', 'Saan yung CECT?',
    'Paano kumuha ng TOR?', 'May event ba CECT this week?', 'Ano announcement para sa CAS?', 'Pwede ba mag-transfer?',
    'Ano dress code?', 'magkano tuition?', 'kailan ang exam?', 'saan magbabayad ng bayad sa school?',
  ]) passes(m)
})

test('short keyword messages are not treated as nonsense', () => {
  for (const m of ['inc', 'tor', 'registrar', 'enrollment', 'scholarship', 'shift course', 'saan registrar', 'kuha tor', 'requirements?', 'event cect']) passes(m)
})

test('campus signals win, and doubt goes through', () => {
  passes('hi, how do I enroll?') // greeting + question
  passes('this stupid portal won\'t let me enroll') // frustrated, but a real question
  passes('joke ba yung deadline ng enrollment?') // campus words beat joke words
  passes('Who is the Dean of CECT?')
  passes('Can I bring my laptop?') // uncertain → normal flow
  passes('What happens if I fail?') // uncertain → normal flow
})
