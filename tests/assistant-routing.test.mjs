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
const deps = { '@/lib/campus/location-match': locationMatch }
const { expandQuery } = load('lib/ai/query-expansion.ts', deps)
const { detectFeedQuestion } = load('lib/campus/feed-match.ts', deps)
const { detectLanguage } = load('lib/ai/language.ts')
const CODES = ['CAS', 'CAMS', 'CBA', 'CCJE', 'CECT', 'CHTM', 'COED', 'CON']

test('Tagalog/Taglish and shorthand gain the English words the handbook uses', () => {
  const has = (q, ...words) => { const e = expandQuery(q); for (const w of words) assert.ok(e.includes(w), `"${q}" → ${e} should include ${w}`) }
  has('Paano kumuha ng TOR?', 'transcript', 'records', 'request')
  has('kuha tor', 'transcript', 'request')
  has('tor', 'transcript', 'records')
  has('Magkano TOR?', 'fee', 'transcript')
  has('How much yung TOR?', 'fee', 'transcript')
  has('Paano ayusin INC ko?', 'incomplete', 'completion')
  has('Paano mag-enroll?', 'enrollment', 'registration')
  has('Pwede ba mag-transfer?', 'transfer')
  has('Paano mag-shift ng course?', 'shifting')
  has('Ano requirements para maging cum laude?', 'requirements', 'honors')
  has('Ano ang uniporme?', 'dress', 'uniform')
  // The original question is kept intact at the start.
  assert.ok(expandQuery('Paano kumuha ng TOR?').startsWith('Paano kumuha ng TOR?'))
  assert.equal(expandQuery('What is the dress code?').startsWith('What is the dress code?'), true)
})

test('events and announcements questions, with window and college', () => {
  assert.deepEqual(detectFeedQuestion('May event ba CECT this week?', CODES), { kind: 'events', window: 'week', department: 'CECT' })
  assert.deepEqual(detectFeedQuestion('May event ba CECT?', CODES), { kind: 'events', window: 'upcoming', department: 'CECT' })
  assert.deepEqual(detectFeedQuestion('Ano event this week?', CODES), { kind: 'events', window: 'week', department: null })
  assert.deepEqual(detectFeedQuestion('Ano ganap ngayon?', CODES), { kind: 'events', window: 'today', department: null })
  assert.deepEqual(detectFeedQuestion('May announcement ba para sa CECT?', CODES), { kind: 'announcements', window: 'upcoming', department: 'CECT' })
  assert.deepEqual(detectFeedQuestion('Ano latest announcement?', CODES), { kind: 'announcements', window: 'upcoming', department: null })
  assert.deepEqual(detectFeedQuestion('event cect', CODES), { kind: 'events', window: 'upcoming', department: 'CECT' })
  assert.deepEqual(detectFeedQuestion('anunsyo para sa CON ngayong linggo', CODES), { kind: 'announcements', window: 'week', department: 'CON' })
  for (const q of ['How do I enroll?', 'Paano kumuha ng TOR?', 'Nasaan yung Registrar?', 'Ano dress code?']) assert.equal(detectFeedQuestion(q, CODES), null, q)
})

test('reply language follows the question', () => {
  for (const q of ['Paano mag-enroll?', 'Ano dress code?', 'How much yung TOR?', 'kuha tor', 'saan registrar', 'May event ba CECT?']) assert.equal(detectLanguage(q), 'fil', q)
  for (const q of ['How do I enroll?', 'tor', 'inc', 'May I request my TOR?', 'Where is the gym?']) assert.equal(detectLanguage(q), 'en', q)
})

test('a bare place name is a location only on an exact match', () => {
  const place = (n, name, building, floor = null, aliases = []) => ({ building_number: n, name, building_name: building, floor, aliases })
  const places = [
    place(1, 'Registrar', 'Gloria D. Lacson Building', 'L1'),
    place(17, 'Main Library', 'JJDG Auditorium & Main Library Building', 'L3', ['library']),
    place(18, 'College of Engineering & Computer Technology', 'Bishop Paul Locke Granadosin Building'),
  ]
  const aliases = new Map([[locationMatch.normalize('College of Engineering and Computer Technology'), ['CECT']]])
  const ask = (q) => { const m = locationMatch.detectPlaceMention(q, 'en'); return m ? locationMatch.matchPlace(m.target, places, aliases, { exactOnly: true }) : null }
  assert.equal(ask('registrar').place.name, 'Registrar')
  assert.equal(ask('library').place.name, 'Main Library')
  assert.equal(ask('cect').place.name, 'College of Engineering & Computer Technology')
  for (const q of ['inc', 'tor', 'kuha tor', 'registrar requirements please now']) {
    const r = ask(q)
    assert.ok(!r || r.kind === 'none', `"${q}" must not become a location`)
  }
})
