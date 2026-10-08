import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
function load(relative, mocks = {}) {
  const filename = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => mocks[id], loaded, loaded.exports)
  return loaded.exports
}

class Redirect extends Error { constructor(to) { super(to); this.to = to } }

/** lib/auth.ts with the signed-in profile (or null for a signed-out visitor). */
function authFor(profile) {
  const supabase = {
    auth: { getClaims: async () => ({ data: profile ? { claims: { sub: profile.id } } : null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  }
  return load('lib/auth.ts', {
    'server-only': {},
    react: { cache: (fn) => fn },
    'next/navigation': { redirect: (to) => { throw new Redirect(to) } },
    '@/lib/supabase/server': { createClient: async () => supabase },
  })
}

async function outcome(fn) {
  try { return { ok: await fn() } } catch (e) { if (e instanceof Redirect) return { redirect: e.to }; throw e }
}

const freshman = { id: 'u1', role: 'student', user_type: 'freshman', must_change_password: false }
const admin = { id: 'a1', role: 'admin', user_type: null, must_change_password: false }

test('signed-out visitors are sent to sign in from protected pages', async () => {
  const auth = authFor(null)
  assert.deepEqual(await outcome(() => auth.requireProfile()), { redirect: '/login' })
  assert.deepEqual(await outcome(() => auth.requireAdmin()), { redirect: '/login' })
})

test('a regular user (freshman or visitor) cannot open admin pages', async () => {
  for (const user of [freshman, { ...freshman, user_type: 'visitor' }]) {
    assert.deepEqual(await outcome(() => authFor(user).requireAdmin()), { redirect: '/app' })
  }
})

test('the existing admin account still reaches /admin', async () => {
  const result = await outcome(() => authFor(admin).requireAdmin())
  assert.equal(result.ok.id, 'a1')
})

test('sign-in destination comes from the database role', () => {
  const auth = authFor(null)
  assert.equal(auth.nextPathFor(freshman), '/app')
  assert.equal(auth.nextPathFor(admin), '/admin')
  // Self-registered users never start on a temporary password; admin-created ones still do.
  assert.equal(auth.nextPathFor({ role: 'student', must_change_password: true }), '/change-password')
})

test('personalization prefers the intended college/program, then the legacy one', () => {
  const auth = authFor(null)
  assert.equal(auth.personalDepartmentId({ intended_department_id: 'd-new', department_id: 'd-old' }), 'd-new')
  assert.equal(auth.personalDepartmentId({ intended_department_id: null, department_id: 'd-old' }), 'd-old')
  assert.equal(auth.personalProgramId({ intended_program_id: null, program_id: null }), null)
})

test('user type labels; the internal "student" role is shown as User', () => {
  const types = load('lib/user-types.ts')
  assert.equal(types.userTypeLabel('freshman'), 'Incoming Freshman')
  assert.equal(types.userTypeLabel('visitor'), 'Visitor')
  assert.equal(types.userTypeLabel(null), null)
  assert.equal(types.roleLabel('student'), 'User')
  assert.equal(types.roleLabel('admin'), 'Administrator')
})
