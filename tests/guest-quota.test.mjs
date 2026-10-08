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

process.env.GUEST_SESSION_SECRET = 'test-secret'

/** A browser's cookie jar for one visitor. */
function cookieJar() {
  const jar = new Map()
  return {
    jar,
    store: {
      get: (name) => (jar.has(name) ? { name, value: jar.get(name).value } : undefined),
      set: (name, value, options) => jar.set(name, { value, options }),
    },
  }
}

function setup({ answers = [], profile = null } = {}) {
  const { jar, store } = cookieJar()
  const quota = load('lib/guest-quota.ts', { 'server-only': {}, 'next/headers': { cookies: async () => store } })
  const queue = [...answers]
  let aiCalls = 0
  const { askPublic } = load('app/actions.ts', {
    'next/headers': { headers: async () => new Map([['x-forwarded-for', `10.0.0.${Math.random()}`]]) },
    '@/lib/ai/campus-agent': {
      answerQuestion: async () => {
        aiCalls++
        const next = queue.shift() ?? { status: 'answered' }
        if (next === 'throw') throw new Error('network down')
        return { summary: 'ok', steps: [], requirements: [], details: '', gaps: '', sources: [], ...next }
      },
    },
    '@/lib/auth': { getCurrentProfile: async () => profile },
    '@/lib/guest-quota': quota,
  })
  return { askPublic, quota, jar, aiCalls: () => aiCalls }
}

test('signed tokens round-trip; edited or foreign tokens are rejected', () => {
  const { quota } = setup()
  const key = Buffer.alloc(32, 1)
  const token = quota.encodeGuestToken({ id: '6f1c2e9a-1b2c-4d3e-8f90-123456789abc', used: 2 }, key)
  assert.deepEqual(quota.decodeGuestToken(token, key), { id: '6f1c2e9a-1b2c-4d3e-8f90-123456789abc', used: 2 })
  assert.equal(quota.decodeGuestToken(token.replace('.2.', '.0.'), key), null) // count edited by hand
  assert.equal(quota.decodeGuestToken(token, Buffer.alloc(32, 2)), null) // signed by another server
  assert.equal(quota.decodeGuestToken('garbage', key), null)
  assert.equal(quota.decodeGuestToken(undefined, key), null)
})

test('a guest gets 3 successful questions, then the sign-up gate', async () => {
  const { askPublic, aiCalls } = setup()
  assert.equal((await askPublic('How do I apply for admission?')).remaining, 2)
  assert.equal((await askPublic('What programs does CECT offer?')).remaining, 1)
  const third = await askPublic('Where is the Registrar?')
  assert.equal(third.ok, true)
  assert.equal(third.remaining, 0)

  const fourth = await askPublic('Are there upcoming campus events?')
  assert.equal(fourth.ok, false)
  assert.equal(fourth.limitReached, true)
  assert.match(fourth.error, /Create an account to continue/)
  assert.equal(aiCalls(), 3) // no AI call once the limit is reached
})

test('the count is stored in an httpOnly cookie, so a page refresh does not reset it', async () => {
  const { askPublic, quota, jar } = setup()
  await askPublic('How do I enroll?')
  const cookie = jar.get('ca_guest')
  assert.equal(cookie.options.httpOnly, true)
  assert.equal((await quota.readGuestQuota()).used, 1) // what the landing page reads on reload
})

test('failed AI requests and server errors do not use a free question', async () => {
  const { askPublic } = setup({ answers: [{ status: 'error' }, 'throw'] })
  const failed = await askPublic('How do I enroll?')
  assert.equal(failed.remaining, 3)
  const crashed = await askPublic('How do I enroll?')
  assert.equal(crashed.ok, false)
  assert.equal(crashed.remaining, 3)
  assert.equal((await askPublic('How do I enroll?')).remaining, 2)
})

test('empty submissions and instant local replies do not count', async () => {
  const { askPublic, aiCalls } = setup({ answers: [{ status: 'answered', handledLocally: true }] })
  const empty = await askPublic('   ')
  assert.equal(empty.ok, false)
  assert.equal(empty.remaining, 3)
  assert.equal(aiCalls(), 0)
  assert.equal((await askPublic('hello')).remaining, 3)
})

test('"not found" answers still count as a successful question', async () => {
  const { askPublic } = setup({ answers: [{ status: 'not_found' }] })
  assert.equal((await askPublic('What is the meaning of life?')).remaining, 2)
})

test('signed-in users have no guest limit', async () => {
  const { askPublic, jar } = setup({ profile: { id: 'u1', role: 'student' } })
  for (let i = 0; i < 5; i++) {
    const result = await askPublic('How do I enroll?')
    assert.equal(result.ok, true)
    assert.equal(result.remaining, null)
  }
  assert.equal(jar.size, 0)
})
