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
function load(relative, mocks) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => (id in mocks ? mocks[id] : nodeRequire(id)), loaded, loaded.exports)
  return loaded.exports
}

// Supabase Auth stand-in: one account, exact password only (like the real service).
const ACCOUNT = { email: 'student@school.edu', password: 'Ab3dEf6hJk9m', id: 'u1', profile: { role: 'user', must_change_password: true } }
function setup() {
  const attempts = []
  const supabase = {
    auth: {
      async signInWithPassword({ email, password }) {
        attempts.push({ email, password })
        const ok = email.toLowerCase() === ACCOUNT.email && password === ACCOUNT.password
        return ok ? { data: { user: { id: ACCOUNT.id } }, error: null } : { data: { user: null }, error: { code: 'invalid_credentials' } }
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: ACCOUNT.profile }) }) }) }),
  }
  class Redirect extends Error { constructor(to) { super(to); this.to = to } }
  const { login } = load('app/(auth)/actions.ts', {
    'next/navigation': { redirect: (to) => { throw new Redirect(to) } },
    '@/lib/auth': { getCurrentProfile: async () => null, nextPathFor: (p) => (p.must_change_password ? '/change-password' : p.role === 'admin' ? '/admin' : '/app') },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/app-url': { appUrl: async () => new URL('http://localhost:3000') },
    '@/lib/forms': load('lib/forms.ts', {}),
    '@/lib/user-types': load('lib/user-types.ts', {}),
  })
  const submit = async (email, password) => {
    const form = new FormData()
    form.set('email', email)
    form.set('password', password)
    try { return { result: await login(undefined, form) } } catch (e) { if (e instanceof Redirect) return { redirect: e.to }; throw e }
  }
  return { submit, attempts }
}

test('temporary password signs in and goes to Change Password', async () => {
  const { submit, attempts } = setup()
  assert.deepEqual(await submit('student@school.edu', 'Ab3dEf6hJk9m'), { redirect: '/change-password' })
  assert.equal(attempts.length, 1)
})

test('stray whitespace from copy/paste no longer blocks sign-in', async () => {
  const { submit, attempts } = setup()
  assert.deepEqual(await submit('  student@school.edu ', 'Ab3dEf6hJk9m \n'), { redirect: '/change-password' })
  assert.equal(attempts[0].email, 'student@school.edu') // email trimmed before Supabase
  assert.equal(attempts[0].password, 'Ab3dEf6hJk9m \n') // exact password always tried first
  assert.equal(attempts[1].password, 'Ab3dEf6hJk9m')
})

test('wrong password still shows the friendly error, with no retry when nothing to trim', async () => {
  const { submit, attempts } = setup()
  assert.deepEqual(await submit('student@school.edu', 'wrong-password'), { result: { error: 'Incorrect email or password.' } })
  assert.equal(attempts.length, 1)
})
