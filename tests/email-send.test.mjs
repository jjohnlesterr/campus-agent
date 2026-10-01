import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
// Loads lib/email/send.ts with a fake Resend SDK that returns `response`.
function loadWith(response) {
  const sent = []
  class Resend { constructor(key) { this.key = key; this.emails = { send: async (msg) => { sent.push(msg); return response } } } }
  const filename = path.join(root, 'lib/email/send.ts')
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => ({ 'server-only': {}, resend: { Resend } })[id], mod, mod.exports)
  return { sendEmail: mod.exports.sendEmail, sent }
}
const message = { to: 'student@school.edu', subject: 'Your Campus Agent account', text: 'Temporary password: Ab3dEf6hJk9m', html: '<p>Ab3dEf6hJk9m</p>' }

function withEnv(vars, fn) {
  const saved = {}
  for (const [k, v] of Object.entries(vars)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v }
  return fn().finally(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } })
}
const configured = { RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'Campus Agent <no-reply@school.edu>' }

test('not configured without RESEND_API_KEY / RESEND_FROM_EMAIL — nothing is sent', () =>
  withEnv({ RESEND_API_KEY: undefined, RESEND_FROM_EMAIL: undefined }, async () => {
    const { sendEmail, sent } = loadWith({ data: { id: '1' }, error: null })
    assert.deepEqual(await sendEmail(message), { ok: false, reason: 'not_configured' })
    assert.equal(sent.length, 0)
  }))

test('sends with the configured sender', () =>
  withEnv(configured, async () => {
    const { sendEmail, sent } = loadWith({ data: { id: '1' }, error: null })
    assert.deepEqual(await sendEmail(message), { ok: true })
    assert.equal(sent[0].from, 'Campus Agent <no-reply@school.edu>')
    assert.deepEqual(sent[0].to, ['student@school.edu'])
  }))

test('Resend testing mode (no verified domain) is reported as such', () =>
  withEnv(configured, async () => {
    const { sendEmail } = loadWith({ data: null, error: { statusCode: 403, name: 'validation_error', message: 'You can only send testing emails to your own email address. To send emails to other recipients, please verify a domain at resend.com/domains' } })
    assert.deepEqual(await sendEmail(message), { ok: false, reason: 'domain_not_verified' })
  }))

test('bad API key or sender is a configuration problem; other errors are failures; password never logged', () =>
  withEnv(configured, async () => {
    const logs = []
    const original = console.error
    console.error = (...args) => logs.push(args.join(' '))
    try {
      assert.deepEqual(await loadWith({ data: null, error: { statusCode: 401, name: 'invalid_api_key', message: 'API key is invalid' } }).sendEmail(message), { ok: false, reason: 'not_configured' })
      assert.deepEqual(await loadWith({ data: null, error: { statusCode: 429, name: 'rate_limit_exceeded', message: 'Too many requests' } }).sendEmail(message), { ok: false, reason: 'failed' })
    } finally { console.error = original }
    assert.ok(logs.length > 0)
    assert.ok(logs.every((l) => !l.includes('Ab3dEf6hJk9m')), 'the temporary password must never be logged')
  }))
