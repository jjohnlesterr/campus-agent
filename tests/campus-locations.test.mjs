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
const m = load('lib/campus/location-match.ts')

// Rows as imported from the official campus map legend.
const place = (building_number, name, building_name, floor = null, aliases = []) => ({ building_number, name, building_name, floor, aliases })
const lacson = 'Gloria D. Lacson Building'
const places = [
  place(1, lacson, lacson),
  place(1, 'Accounting Office', lacson, 'L1'),
  place(1, "Treasurer's Office", lacson, 'L1'),
  place(1, 'Registrar', lacson, 'L1'),
  place(1, 'Office of the President', lacson, 'L2'),
  place(1, 'Office of the Vice President for Finance', lacson, 'L2'),
  place(1, 'Printing Office', lacson, 'L3'),
  place(2, 'University Gymnasium', 'University Gymnasium', null, ['gym']),
  place(7, 'Wesley Divinity School Library', 'Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex', 'L1'),
  place(12, 'WU-P Hospital', 'WU-P Hospital'),
  place(17, 'Main Library', 'JJDG Auditorium & Main Library Building', 'L3', ['library', 'university library']),
  place(18, 'College of Engineering & Computer Technology', 'Bishop Paul Locke Granadosin Building'),
  place(20, 'ID Printing', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L2'),
  place(25, 'CCD Library', 'Patrocinio Ocampo (Elem. & Prep.) Building', 'L1'),
]
// Built at runtime from the departments table: college name → code.
const departments = new Map([[m.normalize('College of Engineering and Computer Technology'), ['CECT']]])

function ask(question) {
  const q = m.detectLocationQuestion(question)
  assert.ok(q, `"${question}" should be a location question`)
  const match = m.matchPlace(q.target, places, departments)
  return { q, match, sentence: match.kind === 'found' ? m.locationSentence(match.place, q.language) : null }
}

test('Registrar: building, number and floor from the legend', () => {
  const { sentence } = ask('Where is the Registrar?')
  assert.equal(sentence, 'Registrar is located on L1 of the Gloria D. Lacson Building (Building 1).')
  assert.equal(ask("Where's the Office of the Registrar?").match.place.name, 'Registrar')
})

test('Filipino question gets a Filipino answer', () => {
  const { q, sentence } = ask('Nasaan ang Accounting Office?')
  assert.equal(q.language, 'fil')
  assert.equal(sentence, 'Ang Accounting Office ay nasa L1 ng Gloria D. Lacson Building (Building 1).')
  assert.equal(ask('saan po makikita yung registrar').match.place.name, 'Registrar')
})

test('buildings, aliases and department codes', () => {
  assert.equal(ask('Where is the University Gymnasium?').sentence, 'The University Gymnasium is Building 2 on the campus map.')
  assert.equal(ask('Where is the gym?').match.place.name, 'University Gymnasium')
  assert.equal(ask('Where is CECT?').sentence, 'College of Engineering & Computer Technology is located in the Bishop Paul Locke Granadosin Building (Building 18).')
  assert.equal(ask('Where is the library?').match.place.name, 'Main Library')
  assert.equal(ask('How do I find the WU-P Hospital?').match.place.name, 'WU-P Hospital')
  assert.equal(ask('Where is Building 1?').match.place.name, lacson)
  assert.equal(ask("What floor is the President's office on?").match.place.name, 'Office of the President')
})

test('closest entry wins; real ties are reported, not guessed', () => {
  assert.equal(ask('Where is the printing office?').match.place.name, 'Printing Office')
  assert.equal(ask('Where is the accounting office ng WUP?').match.place.name, 'Accounting Office')
  const { match } = ask('Where is the vice president?')
  assert.equal(match.kind, 'found') // only one VP in this fixture
  assert.equal(ask('Where is the canteen?').match.kind, 'none')
})

test('ambiguous names list every closest match', () => {
  const extra = [...places, place(1, 'Office of the Vice President for Academic Affairs', lacson, 'L2')]
  const q = m.detectLocationQuestion('Where is the Vice President?')
  const match = m.matchPlace(q.target, extra, departments)
  assert.equal(match.kind, 'ambiguous')
  assert.equal(match.places.length, 2)
})

test('non-location questions are left to the handbook flow', () => {
  for (const question of ['How do I fix an INC?', 'Where do I submit my INC form?', "What are the Dean's List requirements?", 'Saan ako magbabayad ng tuition?', 'How do I enroll?']) {
    assert.equal(m.detectLocationQuestion(question), null, question)
  }
})
