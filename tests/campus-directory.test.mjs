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

const m = load('lib/campus/location-match.ts')
const legendMatch = load('lib/campus/legend-match.ts', { '@/lib/campus/location-match': m })
const guardrail = load('lib/ai/guardrail.ts', { '@/lib/campus/location-match': m })

// The admin-verified directory, in the shape getMapPlaces builds from campus_buildings + campus_locations.
const building = (n, name, aliases = []) => ({ name, building_name: name, building_number: n, floor: null, aliases, kind: 'building' })
const place = (n, buildingName, name, floor = null, aliases = [], area = null) =>
  ({ name, building_name: area ? `${area}, ${buildingName}` : buildingName, building_number: n, floor, aliases, kind: 'place', area })
const LACSON = 'Gloria D. Lacson Building'
const JUDG = 'JUDG Auditorium & Main Library Building'
const COMSCI = 'Bishop Dionisio Alejandro (COMSCI) Building'
const ROXY = 'Roxy Lefforge Complex'
const BOCOBO = 'Dr. Jorge Bocobo Hall (Left Wing)'
const places = [
  building(1, LACSON),
  place(1, LACSON, 'Accounting Office', 'L1'), place(1, LACSON, "Treasurer's Office", 'L1'), place(1, LACSON, 'Registrar', 'L1'),
  place(1, LACSON, 'Office of the President', 'L2'), place(1, LACSON, 'Office of Instruction', 'L2'),
  place(1, LACSON, 'ICT Office', 'L3'), place(1, LACSON, 'College of Criminal Justice Education', 'L4'),
  building(2, 'University Gymnasium', ['gym']),
  building(7, ROXY),
  { name: BOCOBO, building_name: ROXY, building_number: 7, floor: null, aliases: [], kind: 'area', area: BOCOBO },
  place(7, ROXY, 'Graduate School', 'L2', [], BOCOBO),
  building(16, 'Asuncion Perez Building'), place(16, 'Asuncion Perez Building', 'College of Nursing'),
  building(17, JUDG, ['jjdg auditorium & main library building']),
  place(17, JUDG, 'JUDG Auditorium', 'L1', ['jjdg auditorium']), place(17, JUDG, 'Main Library', 'L3', ['library', 'university library']),
  building(18, 'Bishop Paul Locke Granadosin Building'), place(18, 'Bishop Paul Locke Granadosin Building', 'College of Engineering & Computer Technology'),
  building(20, COMSCI),
  place(20, COMSCI, 'University Clinic', 'L1', ['clinic']), place(20, COMSCI, 'Office of Student Affairs', 'L1'),
  place(20, COMSCI, 'ID Printing', 'L2'), place(20, COMSCI, 'College of Allied Medical Sciences', 'L3'),
]
const departments = new Map([
  [m.normalize('College of Engineering and Computer Technology'), ['CECT']],
  [m.normalize('College of Nursing'), ['CON']],
])
const legend = [
  ['A', 'ATM'], ['G', 'Gates'], ['S', 'Security'], ['P', 'Parking Area'], ['AA', 'Assembly Area'],
  ['CR', 'Comfort Room'], ['+', 'Health Service'], ['FC', 'Canteen/Food Court'], ['CMC', 'Crisis Management Command Center'],
].map(([code, label]) => ({ code, label, description: null }))

function where(question) {
  const q = m.detectLocationQuestion(question)
  assert.ok(q, `"${question}" should be a location question`)
  const match = m.matchPlace(q.target, places, departments)
  assert.equal(match.kind, 'found', `"${question}" should find exactly one place`)
  return m.locationSentence(match.place, q.language)
}

function contents(question) {
  const q = m.detectBuildingContentsQuestion(question)
  assert.ok(q, `"${question}" should ask for a building's contents`)
  const match = m.matchPlace(q.target, places.filter(m.isBuilding), new Map(), { fuzzy: true })
  assert.equal(match.kind, 'found', `"${question}" should find one building`)
  return { building: match.place, lines: m.buildingContents(match.place, places), lead: m.contentsSentence(match.place, 1, q.language) }
}

// ---------------------------------------------------------------- office → building

test('Where is the Registrar? → Building 1, Level 1', () => {
  assert.equal(where('Where is the Registrar?'), 'Registrar is located on L1 of the Gloria D. Lacson Building (Building 1).')
  assert.equal(where("Where is the Registrar's Office?"), 'Registrar is located on L1 of the Gloria D. Lacson Building (Building 1).')
})

test('Nasaan ang Accounting Office? → answered in Filipino, Building 1 L1', () => {
  assert.equal(where('Nasaan ang Accounting Office?'), 'Ang Accounting Office ay nasa L1 ng Gloria D. Lacson Building (Building 1).')
})

test('Where is CECT? → Building 18 (college code alias)', () => {
  assert.equal(where('Where is CECT?'), 'College of Engineering & Computer Technology is located in the Bishop Paul Locke Granadosin Building (Building 18).')
  assert.match(where('Where is the College of Engineering and Computer Technology?'), /Building 18/)
})

test('Where is the University Clinic? → Building 20 L1; "clinic" alias too', () => {
  assert.equal(where('Where is the University Clinic?'), 'University Clinic is located on L1 of the Bishop Dionisio Alejandro (COMSCI) Building (Building 20).')
  assert.match(where('Where is the clinic?'), /Building 20/)
})

test('Where is the Main Library? → Building 17 L3; "library" alias', () => {
  assert.equal(where('Where is the Main Library?'), 'Main Library is located on L3 of the JUDG Auditorium & Main Library Building (Building 17).')
  assert.match(where('Where is the library?'), /L3 .*Building 17/)
})

test('Nasaan ang University Gymnasium? → Building 2', () => {
  assert.equal(where('Nasaan ang University Gymnasium?'), 'Ang University Gymnasium ay Building 2 sa campus map.')
})

test('Where is the College of Nursing? → Building 16, no floor invented', () => {
  assert.equal(where('Where is the College of Nursing?'), 'College of Nursing is located in the Asuncion Perez Building (Building 16).')
})

test('places inside a wing keep their hall', () => {
  assert.equal(where('Where is the Graduate School?'), 'Graduate School is located on L2 of Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex (Building 7).')
  assert.equal(where('Where is Bocobo Hall?'), 'Dr. Jorge Bocobo Hall (Left Wing) is located in the Roxy Lefforge Complex (Building 7).')
})

test('the earlier JJDG spelling still finds Building 17', () => {
  assert.match(where('Where is the JJDG Auditorium?'), /JUDG Auditorium is located on L1 .*Building 17/)
})

// ---------------------------------------------------------------- building → offices

test('What is in Building 20? → every place by floor', () => {
  const { building, lines } = contents('What is in Building 20?')
  assert.equal(building.building_number, 20)
  assert.deepEqual(lines, [
    '- **L1:** University Clinic, Office of Student Affairs',
    '- **L2:** ID Printing',
    '- **L3:** College of Allied Medical Sciences',
  ])
})

test('What offices are inside Gloria D. Lacson Building? → floors L1–L4', () => {
  const { building, lines, lead } = contents('What offices are inside Gloria D. Lacson Building?')
  assert.equal(building.building_number, 1)
  assert.equal(lines[0], "- **L1:** Accounting Office, Treasurer's Office, Registrar")
  assert.equal(lines.at(-1), '- **L4:** College of Criminal Justice Education')
  assert.equal(lead, 'According to the campus map, the Gloria D. Lacson Building (Building 1) has:')
  assert.deepEqual(contents('Ano ang nasa Building 1?').building.building_number, 1)
})

test('wings are listed with their hall', () => {
  assert.deepEqual(contents('What is in Building 7?').lines, ['- **Dr. Jorge Bocobo Hall (Left Wing) · L2:** Graduate School'])
})

test('a contents question about an unknown building finds nothing', () => {
  const q = m.detectBuildingContentsQuestion('What is in Building 99?')
  assert.equal(m.matchPlace(q.target, places.filter(m.isBuilding)).kind, 'none')
})

// ---------------------------------------------------------------- legend

const legendAsk = (question) => legendMatch.detectLegendQuestion(question, legend)

test('What does CR mean on the map? → the legend meaning', () => {
  const asked = legendAsk('What does CR mean on the map?')
  assert.equal(asked.kind, 'meaning')
  assert.equal(legendMatch.legendSentence(asked, true), 'On the Campus Map, “CR” means Comfort Room.')
})

test('Is there parking on campus? → yes, marked P, no spot invented', () => {
  const asked = legendAsk('Is there parking on campus?')
  const sentence = legendMatch.legendSentence(asked, true)
  assert.equal(sentence, 'Yes. The Campus Map marks Parking Area with the “P” symbol. Check the map to see where they are.')
  assert.doesNotMatch(sentence + legendMatch.legendNote('en'), /Building \d|\bnear\b|beside|next to/i, 'never an exact position')
})

test('May comfort room ba? → Filipino, CR symbol, points to the map', () => {
  const asked = legendAsk('May comfort room ba?')
  assert.equal(asked.language, 'fil')
  assert.equal(legendMatch.legendSentence(asked, true), 'Oo. Ang Comfort Room ay may markang “CR” sa Campus Map. Tingnan ang mapa para makita kung saan ito banda.')
})

test('everyday words find legend symbols; unrelated or procedural questions do not', () => {
  assert.equal(legendAsk('Where is the ATM?').entry.code, 'A')
  assert.equal(legendAsk('Is there a canteen?').entry.code, 'FC')
  assert.equal(legendAsk('Are there restrooms?').entry.code, 'CR')
  assert.equal(legendAsk('What are the parking rules for visitors who bring a car to campus every day?'), null, 'long procedural question → handbook')
  assert.equal(legendAsk('How do I fix an INC?'), null)
  assert.equal(legendAsk('What does "a" mean?')?.entry.code, 'A')
  assert.equal(legendAsk('Is there a gym?'), null, 'one-letter codes are not read from ordinary words')
})

// ---------------------------------------------------------------- unknown places and routing

test('unknown places are not guessed', () => {
  const q = m.detectLocationQuestion('Where is the swimming pool?')
  assert.equal(m.matchPlace(q.target, places, departments).kind, 'none')
  assert.equal(m.notFoundSentence(q.target, 'en'), 'I couldn’t verify the exact location of “swimming pool” from the official campus map.'.replace('’', "'"))
})

test('campus questions are not stopped by the guardrail before lookup', () => {
  for (const question of ['Where is the Registrar?', 'What is in Building 20?', 'May comfort room ba?', 'Is there parking on campus?', 'What does CR mean on the map?']) {
    assert.equal(guardrail.classifyMessage(question).handledLocally, false, question)
  }
})

// ---------------------------------------------------------------- directory page helpers

const dir = load('lib/campus/directory.ts', { '@/lib/campus/location-match': m })
const p = (id, name, floor = null, area = null, aliases = []) => ({ id, name, floor, area, aliases, kind: 'place' })
const lacsonDir = { id: 'b1', number: 1, name: LACSON, description: null, isActive: true, places: [
  p('reg', 'Registrar', 'L1'), p('acc', 'Accounting Office', 'L1'), p('pres', 'Office of the President', 'L2'), p('ccje', 'College of Criminal Justice Education', 'L4'),
] }
const roxyDir = { id: 'b7', number: 7, name: ROXY, description: null, isActive: true, places: [
  { id: 'hall', name: BOCOBO, floor: null, area: BOCOBO, aliases: [], kind: 'area' },
  p('gs', 'Graduate School', 'L2', BOCOBO), p('hs', 'High School Department', 'L1', BOCOBO), p('med', 'College of Medicine', 'L1', 'Dr. Gumersindo Garcia Hall (Right Wing)'),
] }
const clinicDir = { id: 'b20', number: 20, name: COMSCI, description: null, isActive: true, places: [p('clinic', 'University Clinic', 'L1', null, ['clinic'])] }

test('the directory groups offices by hall, then floor; halls are headings, not offices', () => {
  assert.deepEqual(dir.groupPlaces(lacsonDir.places).map((g) => [g.floor, g.places.map((x) => x.name)]), [
    ['L1', ['Registrar', 'Accounting Office']], ['L2', ['Office of the President']], ['L4', ['College of Criminal Justice Education']],
  ])
  assert.deepEqual(dir.groupPlaces(roxyDir.places).map((g) => `${g.area} · ${g.floor}`), [
    'Dr. Gumersindo Garcia Hall (Right Wing) · L1', `${BOCOBO} · L1`, `${BOCOBO} · L2`,
  ])
})

test('map page search: building number, building name, office name or alias', () => {
  const search = (q) => [lacsonDir, roxyDir, clinicDir].filter((b) => dir.matchesDirectorySearch(b, q)).map((b) => b.number)
  assert.deepEqual(search(''), [1, 7, 20])
  assert.deepEqual(search('18'), [])
  assert.deepEqual(search('Building 20'), [20])
  assert.deepEqual(search('registrar'), [1])
  assert.deepEqual(search('clinic'), [20])
  assert.deepEqual(search('graduate'), [7])
  assert.deepEqual(search('lacson'), [1])
  assert.deepEqual(search('swimming pool'), [])
  assert.deepEqual([...dir.matchingPlaces(lacsonDir, 'registrar')], ['reg'], 'only the matching office is highlighted')
})

test('admin directory: college codes and building aliases are search-only terms; only matching offices are highlighted', () => {
  const cect = { id: 'b18', number: 18, name: 'Bishop Paul Locke Granadosin Building', description: null, isActive: true, places: [p('eng', 'College of Engineering & Computer Technology')] }
  const library = { id: 'b17', number: 17, name: 'JUDG Auditorium & Main Library Building', description: null, isActive: true, places: [p('lib', 'Main Library', 'L3', null, ['library'])] }
  const gym = { id: 'b2', number: 2, name: 'University Gymnasium', description: null, isActive: true, places: [] }
  const all = [lacsonDir, gym, roxyDir, library, cect, clinicDir]
  const extra = new Map([['eng', ['CECT']], ['b2', ['gym']]])
  const search = (q) => all.filter((b) => dir.matchesDirectorySearch(b, q, extra)).map((b) => b.number)
  assert.deepEqual(search('Registrar'), [1])
  assert.deepEqual(search('CECT'), [18])
  assert.deepEqual(search('Main Library'), [17])
  assert.deepEqual(search('Clinic'), [20])
  assert.deepEqual(search('Building 20'), [20])
  assert.deepEqual(search('gym'), [2])
  assert.deepEqual(all.filter((b) => dir.matchesDirectorySearch(b, 'CECT')).map((b) => b.number), [], 'without the extra terms, codes are not stored aliases')

  assert.deepEqual([...dir.placesMatchingSearch(lacsonDir, 'registrar', extra)], ['reg'])
  assert.deepEqual([...dir.placesMatchingSearch(cect, 'cect', extra)], ['eng'])
  assert.deepEqual([...dir.placesMatchingSearch(library, 'main library', extra)], ['lib'], 'the office is highlighted, not every office in the building')
  assert.equal(dir.placesMatchingSearch(clinicDir, 'building 20', extra).size, 0, 'a number search opens nothing by itself')
  assert.equal(dir.placesMatchingSearch(lacsonDir, '', extra).size, 0)
})

test('collapsed building rows describe their contents without stored counts', () => {
  assert.equal(dir.describeBuildingContents(lacsonDir), '3 levels · 4 locations')
  assert.equal(dir.describeBuildingContents(roxyDir), '2 halls · 2 levels · 3 locations')
  assert.equal(dir.describeBuildingContents(clinicDir), '1 level · 1 location')
  assert.equal(dir.describeBuildingContents({ ...clinicDir, places: [] }), 'No sub-locations')
})

test('directory renders in batches of 10 in building order; search covers every building', () => {
  const buildings = Array.from({ length: 35 }, (_, i) => ({ number: 35 - i, name: `B${35 - i}` }))
  const win = (limit, searching = false) => dir.directoryWindow(buildings, limit, searching)
  assert.deepEqual(win(10).shown.map((b) => b.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(win(10).hasMore, true)
  const twenty = win(20).shown.map((b) => b.number)
  assert.deepEqual(twenty, Array.from({ length: 20 }, (_, i) => i + 1), 'next batch continues in order')
  assert.equal(new Set(twenty).size, twenty.length, 'no duplicates')
  assert.equal(win(40).shown.length, 35)
  assert.equal(win(40).hasMore, false, 'stops when everything is shown')
  // Searching shows every match at once, even ones past the current batch.
  const clinic = [{ number: 20, name: 'COMSCI' }, { number: 3, name: 'Other' }]
  assert.deepEqual(dir.directoryWindow(clinic, 1, true).shown.map((b) => b.number), [3, 20])
  assert.equal(dir.directoryWindow(clinic, 1, true).hasMore, false)
  assert.deepEqual(buildings[0].number, 35, 'input is not reordered')
})
