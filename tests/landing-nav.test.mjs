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

function load(relative, mocks) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => (id in mocks ? mocks[id] : nodeRequire(id)), loaded, loaded.exports)
  return loaded.exports
}

const h = React.createElement
const passthrough = ({ children }) => h(React.Fragment, null, children)
const { LandingNav } = load('components/landing/landing-nav.tsx', {
  'next/link': { default: ({ href, children, className }) => h('a', { href, className }, children) },
  '@/components/shared/logo': { Logo: () => null },
  '@/components/ui/button': { buttonVariants: () => 'btn' },
  '@/lib/motion': { pressMotion: '' },
  // Render only the header bar, not the mobile menu sheet.
  '@/components/ui/sheet': { Sheet: () => null, SheetContent: passthrough, SheetTitle: passthrough, SheetTrigger: passthrough },
})

/** Header links as "label → href" (desktop label; the phone-only short label is dropped). */
function links(account) {
  const html = renderToStaticMarkup(h(LandingNav, { account }))
  return [...html.matchAll(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(([, href, inner]) => {
    const label = inner.replace(/<span class="sm:hidden">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim()
    return `${label} → ${href}`
  })
}

test('on phones the signed-in button uses a short label so the header fits at 360px', () => {
  const html = renderToStaticMarkup(h(LandingNav, { account: { homeHref: '/app' } }))
  assert.match(html, /<span class="sm:hidden">Open app<\/span><span class="hidden sm:inline">Open Campus Agent<\/span>/)
})

test('guests see Sign in and Create account', () => {
  const guest = links(null)
  assert.ok(guest.includes('Sign in → /login'))
  assert.ok(guest.includes('Create account → /signup'))
  assert.ok(!guest.some((l) => l.startsWith('Open Campus Agent')))
})

test('public links are How It Works, Sources and About, all sections of the landing page', () => {
  for (const account of [null, { homeHref: '/app' }]) {
    const all = links(account)
    for (const l of ['How It Works → /#how-it-works', 'Sources → /#sources', 'About → /#about']) assert.ok(all.includes(l), l)
    assert.ok(!all.some((l) => l.startsWith('Campus Map')))
    // No public link leads into the signed-in app (which would redirect guests to Sign in).
    assert.ok(!all.some((l) => /^(How It Works|Sources|About|Guides) → \/(app|guides)/.test(l)), all.join(', '))
  }
})

test('signed-in users see Open Campus Agent instead of the sign-in actions', () => {
  const user = links({ homeHref: '/app' })
  assert.ok(user.includes('Open Campus Agent → /app'))
  assert.ok(!user.some((l) => /profile/i.test(l)))
  assert.ok(!user.some((l) => l.startsWith('Sign in') || l.startsWith('Create account')))
})

test('a signed-in admin opens /admin', () => {
  const admin = links({ homeHref: '/admin' })
  assert.ok(admin.includes('Open Campus Agent → /admin'))
  assert.ok(!admin.some((l) => l.startsWith('Profile') || l.startsWith('Sign in') || l.startsWith('Create account')))
})

test('no admin sign-up or admin login option is exposed', () => {
  for (const account of [null, { homeHref: '/app' }]) {
    assert.ok(!links(account).some((l) => /admin/i.test(l.split(' → ')[0])))
  }
})
