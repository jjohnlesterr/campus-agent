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
const { announcementTopics, detectAnnouncementQuestion, matchAnnouncements, matchesTopics } = load('lib/campus/announcement-match.ts', deps)
const { detectLanguage } = load('lib/ai/language.ts')

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

test('announcement questions: topic, window and latest', () => {
  const q = (text) => detectAnnouncementQuestion(text)
  assert.deepEqual(q('May announcement ba tungkol sa enrollment?'), { window: 'any', topics: ['enrollment'], terms: [], latest: false })
  assert.deepEqual(q('May suspension ba?'), { window: 'any', topics: ['suspension'], terms: [], latest: false })
  assert.deepEqual(q('Walang pasok ba ngayon?'), { window: 'today', topics: ['suspension'], terms: [], latest: false })
  assert.deepEqual(q('May scholarship announcement?'), { window: 'any', topics: ['scholarship'], terms: [], latest: false })
  assert.deepEqual(q('Ano latest advisory?'), { window: 'any', topics: ['advisory'], terms: [], latest: true })
  assert.deepEqual(q('May announcement ba today?'), { window: 'today', topics: [], terms: [], latest: false })
  assert.deepEqual(q('anunsyo ngayong linggo'), { window: 'week', topics: [], terms: [], latest: false })
  assert.deepEqual(q('Ano latest announcement?'), { window: 'any', topics: [], terms: [], latest: true })
  // Former Events questions are now about official university activities.
  assert.deepEqual(q('Are there upcoming campus events?'), { window: 'any', topics: ['activity'], terms: [], latest: false })
  assert.deepEqual(q('Announcement about ID validation?'), { window: 'any', topics: [], terms: ['validation'], latest: false })
  // Procedures and places go to the Knowledge Library / campus map, not announcements.
  for (const text of ['How do I enroll?', 'Kailan enrollment?', 'Paano kumuha ng TOR?', 'Nasaan yung Registrar?', 'Ano dress code?', 'Pasok ba sa requirements?']) assert.equal(q(text), null, text)
})

test('announcement topics match by wording; nothing matching means nothing', () => {
  const rows = [
    { id: 1, title: 'Second semester enrollment schedule', content: 'Enrollment runs from Oct 20 to 31.' },
    { id: 2, title: 'Classes suspended', content: 'Walang pasok tomorrow due to the typhoon.' },
    { id: 3, title: 'Scholarship application reminder', content: 'Submit forms by Friday.' },
    { id: 4, title: 'Library hours', content: 'Open until 8 PM.' },
  ]
  const ids = (text) => matchAnnouncements(rows, detectAnnouncementQuestion(text)).map((r) => r.id)
  assert.deepEqual(ids('May announcement ba tungkol sa enrollment?'), [1])
  assert.deepEqual(ids('May suspension ba?'), [2])
  assert.deepEqual(ids('May scholarship announcement?'), [3])
  assert.deepEqual(ids('Ano latest announcement?'), [1, 2, 3, 4])
  assert.deepEqual(ids('Ano latest advisory?'), [], 'no advisory is published, so none is shown')
  assert.deepEqual(announcementTopics('Kailan enrollment?'), ['enrollment'])
  assert.deepEqual(announcementTopics('Paano kumuha ng TOR?'), [])
  assert.equal(matchesTopics(rows[0], ['enrollment']), true)
  assert.equal(matchesTopics(rows[3], ['enrollment']), false)
})

test('reply language follows the question', () => {
  for (const q of ['Paano mag-enroll?', 'Ano dress code?', 'How much yung TOR?', 'kuha tor', 'saan registrar', 'May suspension ba?']) assert.equal(detectLanguage(q), 'fil', q)
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
