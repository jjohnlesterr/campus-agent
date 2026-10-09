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
const email = load('lib/email/account-email.ts')

const input = { fullName: 'Juan Dela Cruz', resetUrl: 'https://campus.example/auth/confirm?token_hash=abc&type=recovery' }

test('password reset email has the link and no password', () => {
  const { subject, text, html } = email.buildPasswordResetEmail(input)
  assert.equal(subject, 'Reset your Campus Agent password')
  assert.ok(text.includes('Hello Juan Dela Cruz,'))
  assert.ok(text.includes(input.resetUrl))
  assert.ok(html.includes(`href="${input.resetUrl.replace(/&/g, '&amp;')}"`))
  assert.ok(!/temporary password/i.test(text), 'no password is ever included')
  assert.ok(text.trimEnd().endsWith('Campus Agent'))
})

test('the temporary-password account email no longer exists', () => {
  assert.equal(email.buildAccountEmail, undefined)
})

test('white-label name and HTML escaping', () => {
  const { subject, html } = email.buildPasswordResetEmail({ ...input, fullName: '<script>x</script>', assistantName: 'Wesleyan Agent' })
  assert.equal(subject, 'Reset your Wesleyan Agent password')
  assert.ok(!html.includes('<script>x</script>'))
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'))
})

test('logo only from a public URL; otherwise a text wordmark', () => {
  const withLogo = email.buildPasswordResetEmail({ ...input, logoUrl: 'https://campus.example/assets/logo.png' }).html
  assert.ok(withLogo.includes('<img src="https://campus.example/assets/logo.png"'))
  const wordmark = email.buildPasswordResetEmail(input).html
  assert.ok(!wordmark.includes('<img'))
  assert.ok(wordmark.includes('Campus <span'))
})
