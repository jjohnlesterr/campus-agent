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

// Supabase stand-in: records signUp calls.
function setup({ session = true, signUpError = null } = {}) {
  const calls = []
  const supabase = {
    auth: {
      async signUp(args) {
        calls.push(args)
        if (signUpError) return { data: { user: null, session: null }, error: signUpError }
        return { data: { user: { id: 'u1' }, session: session ? { access_token: 't' } : null }, error: null }
      },
    },
  }
  class Redirect extends Error { constructor(to) { super(to); this.to = to } }
  const { signup } = load('app/(auth)/actions.ts', {
    'next/navigation': { redirect: (to) => { throw new Redirect(to) } },
    '@/lib/auth': { getCurrentProfile: async () => null, nextPathFor: () => '/app' },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/app-url': { appUrl: async () => new URL('https://campus.example') },
  })
  const submit = async (fields) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.set(k, v)
    try { return { result: await signup(undefined, form) } } catch (e) { if (e instanceof Redirect) return { redirect: e.to }; throw e }
  }
  return { submit, calls }
}

const VALID = { full_name: 'Maria Santos', email: 'maria.santos@gmail.com', password: 'longenough1', confirm: 'longenough1' }

test('full name, email and password are enough to sign up; any email domain works', async () => {
  const { submit, calls } = setup()
  assert.deepEqual(await submit(VALID), { redirect: '/app' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].email, 'maria.santos@gmail.com')
  assert.equal(calls[0].options.emailRedirectTo, 'https://campus.example/auth/confirm')
  // The full name is stored as the profile's display name; signup_source skips the forced password change.
  assert.deepEqual(calls[0].options.data, { full_name: 'Maria Santos', signup_source: 'self' })
})

test('with email confirmation on, the user is asked to check their inbox', async () => {
  const { submit } = setup({ session: false })
  assert.deepEqual(await submit({ ...VALID, email: 'Guest@Example.org' }), { result: { confirmEmail: 'guest@example.org' } })
})

test('a role or extra profile fields in the form are ignored', async () => {
  const { submit, calls } = setup()
  await submit({ ...VALID, role: 'admin', must_change_password: 'false', user_type: 'visitor', intended_department_id: '11111111-1111-4111-8111-111111111111' })
  assert.deepEqual(Object.keys(calls[0].options.data).sort(), ['full_name', 'signup_source'])
  assert.equal(JSON.stringify(calls[0]).includes('admin'), false)
})

test('required fields are validated on the server', async () => {
  const { submit, calls } = setup()
  const { result } = await submit({ full_name: '', email: 'not-an-email', password: 'short', confirm: 'other' })
  assert.deepEqual(Object.keys(result.fieldErrors).sort(), ['confirm', 'email', 'full_name', 'password'])
  const mismatch = await submit({ ...VALID, confirm: 'different1' })
  assert.match(mismatch.result.fieldErrors.confirm, /don't match/)
  assert.equal(calls.length, 0)
})

test('user type, college, program, student ID and year level are not required', async () => {
  const { submit } = setup()
  assert.deepEqual(await submit(VALID), { redirect: '/app' })
})

test('sign-ups disabled in Supabase gets a clear message, not "try again"', async () => {
  const { submit } = setup({ signUpError: { code: 'signup_disabled', status: 422 } })
  const { result } = await submit(VALID)
  assert.match(result.error, /isn't available/)
})

test('an existing email gets a clear message', async () => {
  const { submit } = setup({ signUpError: { code: 'user_already_exists', status: 422 } })
  const { result } = await submit(VALID)
  assert.match(result.fieldErrors.email, /already exists/)
})
