import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const nodeRequire = createRequire(import.meta.url)
const code = ts.transpileModule(fs.readFileSync(new URL('../components/assistant/answer-view.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const mocks = {
  'next/link': { default: ({ children }) => React.createElement('a', null, children) },
  '@/components/assistant/simple-markdown': { SimpleMarkdown: ({ text }) => React.createElement('span', null, text) },
  '@/components/ui/button': { buttonVariants: () => '' },
  '@/lib/announcements': { safeSourceUrl: () => null },
}
const loaded = { exports: {} }
vm.runInThisContext(`(function(require,module,exports){${code}\n})`)((id) => id in mocks ? mocks[id] : nodeRequire(id), loaded, loaded.exports)
const { AnswerView } = loaded.exports
const complete = {
  status: 'answered', summary: 'Pay ₱100 at the Treasurer’s Office.', steps: ['Request COG at the Registrar’s Office.'], requirements: [], details: 'Same-day or next-day processing.', gaps: '',
  sources: [{ label: 'University FAQ — Pages 2, 3', documentTitle: 'University FAQ', pageNumber: 2, sectionTitle: 'Documents and Academic Requests' }],
}
const render = (answer, variant) => renderToStaticMarkup(React.createElement(AnswerView, { answer, variant }))

test('complete student and public answers show details/citations without a warning or disclaimer', () => {
  for (const variant of ['student', 'public']) {
    const html = render({ ...complete, gaps: 'A stale limitation that does not belong on a full answer.' }, variant)
    assert.match(html, /₱100/)
    assert.match(html, /Same-day or next-day/)
    assert.match(html, /University FAQ — Pages 2, 3/)
    assert.doesNotMatch(html, /Not covered|stale limitation|confirm with the responsible/i)
  }
})

test('partial answers in both surfaces show specific omissions in the answer language, without a handbook box', () => {
  const gaps = 'Hindi tinutukoy sa available university information ang eksaktong replacement fee.'
  for (const variant of ['student', 'public']) {
    const html = render({ ...complete, status: 'partial', summary: 'Pumunta sa OSA para sa replacement form.', gaps }, variant)
    assert.match(html, /Pumunta sa OSA/)
    assert.ok(html.includes(gaps))
    assert.doesNotMatch(html, /Not covered|For exact procedures|rounded-lg border bg-muted/)
    assert.match(html, /University FAQ — Pages 2, 3/)
  }
})

test('no-source fallback remains distinct from a cited partial answer', () => {
  const html = render({ ...complete, status: 'not_found', summary: 'No reliable university source was found.', sources: [], steps: [], details: '' }, 'student')
  assert.match(html, /No reliable university source was found/)
  assert.doesNotMatch(html, /University FAQ|Source:|Not covered/)
})
