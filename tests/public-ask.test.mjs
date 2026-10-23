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
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const h = React.createElement

function load(relative, mocks = {}) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(
    (id) => id in mocks ? mocks[id] : nodeRequire(id), loaded, loaded.exports,
  )
  return loaded.exports
}

const { PublicAsk } = load('components/landing/public-ask.tsx', {
  '@/app/actions': { askPublic: () => { throw new Error('Rendering must not submit a question') } },
  '@/components/assistant/answer-view': { AnswerView: () => null },
  '@/components/assistant/question-composer': load('components/assistant/question-composer.tsx'),
  'next/link': { default: ({ children, ...props }) => h('a', props, children) },
})
const suggestions = [
  'How do I apply for admission?',
  'What programs does CECT offer?',
  'What are the freshman requirements?',
  'Where is the Registrar?',
  'Are there any new university announcements?',
]

for (const remaining of [3, 1, 0, null]) {
  test('landing chat stays visible with ' + (remaining ?? 'unlimited') + ' questions remaining', () => {
    const html = renderToStaticMarkup(h(PublicAsk, { suggestions, initialRemaining: remaining }))
    const fieldset = html.match(/<fieldset([^>]*)>([\s\S]*?)<\/fieldset>/)
    assert.ok(fieldset, 'the chat interface must stay mounted')
    assert.equal(/\bdisabled=""/.test(fieldset[1]), remaining === 0)
    assert.match(fieldset[2], /<textarea/)
    assert.equal((fieldset[2].match(/type="button"/g) ?? []).length, 5)
    for (const suggestion of suggestions) assert.ok(fieldset[2].includes(suggestion))

    if (remaining === 0) {
      assert.equal((html.match(/3-question limit/g) ?? []).length, 1)
      const reminder = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].find((match) => match[1].includes('3-question limit'))
      assert.ok(reminder.index > html.indexOf('</fieldset>'), 'reminder must follow the disabled controls')
      const text = reminder[1].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
      assert.equal(text, "You've reached the 3-question limit. Create an account or sign in to continue chatting.")
      assert.match(reminder[1], /href="\/signup"/)
      assert.match(reminder[1], /href="\/login"/)
      assert.doesNotMatch(fieldset[2], /href="\/(signup|login)"/)
      assert.doesNotMatch(html, /0 questions remaining/)
    } else {
      assert.doesNotMatch(html, /3-question limit/)
      if (remaining === 3) assert.match(html, /You can ask up to 3 questions before creating an account\./)
      if (remaining === 1) assert.match(html, /1 question remaining/)
      if (remaining === null) assert.doesNotMatch(html, /questions? remaining|before creating an account/)
    }
  })
}
