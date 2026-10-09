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
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })((id) => id in mocks ? mocks[id] : nodeRequire(id), loaded, loaded.exports)
  return loaded.exports
}

const ME = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const OTHER_ADMIN = '33333333-3333-4333-8333-333333333333'
const profiles = {
  [ME]: { id: ME, role: 'admin', full_name: 'Admin', email: 'admin@example.edu', deactivated_at: null },
  [USER]: { id: USER, role: 'user', full_name: 'Ana Cruz', email: 'ana@example.com', deactivated_at: null },
  [OTHER_ADMIN]: { id: OTHER_ADMIN, role: 'admin', full_name: 'Other', email: 'other@example.edu', deactivated_at: null },
}

function setup({ sent = { ok: true } } = {}) {
  const calls = []
  const session = {
    from: () => ({ select: () => ({ eq: (_k, id) => ({ maybeSingle: async () => ({ data: profiles[id] ?? null }) }) }) }),
  }
  const admin = {
    auth: {
      admin: {
        generateLink: async (input) => { calls.push(['generateLink', input]); return { data: { properties: { hashed_token: 'hashed-token' } }, error: null } },
        updateUserById: async (id, input) => { calls.push(['updateUserById', id, input]); return { error: null } },
        deleteUser: async (id) => { calls.push(['deleteUser', id]); return { error: null } },
      },
    },
    from: () => ({ update: (values) => ({ eq: async (_k, id) => { calls.push(['profiles.update', id, values]); return { error: null } } }) }),
  }
  const emails = []
  const actions = load('app/admin/users/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() {} },
    '@/lib/app-url': { appUrl: async () => new URL('https://campus.example.edu') },
    '@/lib/auth': { requireAdmin: async () => profiles[ME] },
    '@/lib/branding': { getBranding: async () => ({ assistantName: 'Campus Agent' }) },
    '@/lib/email/account-email': load('lib/email/account-email.ts'),
    '@/lib/email/send': { sendEmail: async (message) => { emails.push(message); return sent } },
    '@/lib/forms': load('lib/forms.ts'),
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { createClient: async () => session },
  })
  return { ...actions, calls, emails }
}

test('the signed-in admin and other admins can never be reset, deactivated or deleted here', async () => {
  for (const id of [ME, OTHER_ADMIN, 'not-a-uuid']) {
    const { sendPasswordReset, setAccountActive, deleteAccount, calls } = setup()
    assert.equal((await sendPasswordReset(id)).ok, false)
    assert.equal((await setAccountActive(id, false)).ok, false)
    assert.equal((await deleteAccount(id)).ok, false)
    assert.deepEqual(calls, [], 'nothing reaches Supabase Auth or the profile')
  }
})

test('password reset emails a one-time recovery link to the sign-in email; no password is exposed', async () => {
  const { sendPasswordReset, calls, emails } = setup()
  const result = await sendPasswordReset(USER)
  assert.deepEqual(result, { ok: true, message: 'Password reset email sent to ana@example.com.' })
  assert.deepEqual(calls, [['generateLink', { type: 'recovery', email: 'ana@example.com' }]])
  assert.match(emails[0].text, /https:\/\/campus\.example\.edu\/auth\/confirm\?token_hash=hashed-token&type=recovery/)
  const failed = await setup({ sent: { ok: false, reason: 'not_configured' } }).sendPasswordReset(USER)
  assert.equal(failed.ok, false, 'an email that was not sent is reported, never assumed')
})

test('deactivate bans the Auth user and marks the profile; reactivate undoes both', async () => {
  const { setAccountActive, calls } = setup()
  assert.equal((await setAccountActive(USER, false)).ok, true)
  assert.deepEqual(calls[0], ['updateUserById', USER, { ban_duration: '876000h' }])
  assert.equal(calls[1][0], 'profiles.update')
  assert.ok(calls[1][2].deactivated_at)
  assert.equal((await setAccountActive(USER, true)).ok, true)
  assert.deepEqual(calls[2], ['updateUserById', USER, { ban_duration: 'none' }])
  assert.deepEqual(calls[3], ['profiles.update', USER, { deactivated_at: null }])
})

test('delete removes only the target Auth user (profile rows follow by cascade)', async () => {
  const { deleteAccount, calls } = setup()
  assert.deepEqual(await deleteAccount(USER), { ok: true, message: 'Account deleted.' })
  assert.deepEqual(calls, [['deleteUser', USER]])
})
