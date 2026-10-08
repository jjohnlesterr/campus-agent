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
const { buildAccountEmail } = load('lib/email/account-email.ts')

const input = { fullName: 'Juan Dela Cruz', email: 'juan@school.edu', temporaryPassword: 'Ab3dEf6hJk9m', loginUrl: 'https://campus.example/login' }

test('account-created email has the requested content', () => {
  const { subject, text, html } = buildAccountEmail(input)
  assert.equal(subject, 'Your Campus Agent account')
  for (const line of [
    'Hello Juan Dela Cruz,',
    'Your Campus Agent account has been created by your university administrator.',
    'Email:\njuan@school.edu',
    'Temporary password:\nAb3dEf6hJk9m',
    'Sign in:\nhttps://campus.example/login',
    'You will be asked to create a new password the first time you sign in.',
    'For security, do not share your password with anyone.',
  ]) assert.ok(text.includes(line), `text should include: ${line}`)
  assert.ok(text.trimEnd().endsWith('Campus Agent'), 'signed "Campus Agent"')
  assert.ok(html.includes('Ab3dEf6hJk9m') && html.includes('href="https://campus.example/login"'))
})

test('reset email says the password was replaced', () => {
  const { subject, text } = buildAccountEmail({ ...input, reason: 'reset' })
  assert.equal(subject, 'Your new Campus Agent temporary password')
  assert.ok(text.includes('has set a new temporary password'))
})

test('white-label name and HTML escaping', () => {
  const { subject, html } = buildAccountEmail({ ...input, fullName: '<script>x</script>', assistantName: 'Wesleyan Agent' })
  assert.equal(subject, 'Your Wesleyan Agent account')
  assert.ok(!html.includes('<script>x</script>'))
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'))
})

test('logo only from a public URL; otherwise a text wordmark', () => {
  const withLogo = buildAccountEmail({ ...input, logoUrl: 'https://campus.example/assets/logo.png' }).html
  assert.ok(withLogo.includes('<img src="https://campus.example/assets/logo.png"'))
  const wordmark = buildAccountEmail(input).html
  assert.ok(!wordmark.includes('<img'))
  assert.ok(wordmark.includes('Campus <span'))
})
