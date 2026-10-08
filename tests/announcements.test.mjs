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

const announcements = load('lib/announcements.ts')
const datetime = load('lib/datetime.ts')
const locationMatch = load('lib/campus/location-match.ts')
const match = load('lib/campus/announcement-match.ts', { '@/lib/campus/location-match': locationMatch })
const FB = 'https://www.facebook.com/WesleyanUniversityPhilippines/posts/123'

test('source links are shown only for http(s) URLs', () => {
  assert.equal(announcements.safeSourceUrl(FB), FB)
  assert.equal(announcements.safeSourceUrl('javascript:alert(1)'), null)
  assert.equal(announcements.safeSourceUrl('not a url'), null)
  assert.equal(announcements.sourceSummary('Official university page', FB), 'Official university page')
  assert.equal(announcements.sourceSummary('', FB), 'Facebook post')
  assert.equal(announcements.sourceSummary(null, 'https://www.example.edu/notice'), 'example.edu')
  assert.equal(announcements.sourceSummary(null, null), null)
})

test('admin list filters by status tab and search', () => {
  const rows = [
    { id: 1, title: 'Enrollment schedule', content: 'Second semester', status: 'published', source: null },
    { id: 2, title: 'Typhoon advisory', content: 'Classes suspended', status: 'draft', source: 'Official Facebook page' },
    { id: 3, title: 'Old notice', content: 'Library hours', status: 'archived', source: null },
  ]
  const ids = (options) => announcements.filterAnnouncements(rows, { tab: 'all', query: '', ...options }).map((r) => r.id)
  assert.deepEqual(ids({}), [1, 2, 3])
  assert.deepEqual(ids({ tab: 'published' }), [1])
  assert.deepEqual(ids({ tab: 'draft' }), [2])
  assert.deepEqual(ids({ tab: 'archived' }), [3])
  assert.deepEqual(ids({ query: 'SUSPENDED' }), [2])
  assert.deepEqual(ids({ query: 'facebook' }), [2], 'the source label is searchable')
  assert.equal(announcements.announcementTab('bogus'), 'all')
  assert.equal(announcements.announcementSort('oldest'), 'oldest')
  assert.equal(announcements.announcementSort('bogus'), 'newest', 'newest first by default')
})

test('announcements sort by published date, newest or oldest first', () => {
  const rows = [
    { id: 'mid', publish_at: '2026-10-05T16:00:00Z', created_at: '2026-10-01T00:00:00Z' },
    { id: 'new', publish_at: '2026-10-07T16:00:00Z', created_at: '2026-09-01T00:00:00Z' },
    { id: 'old', publish_at: '2026-09-20T16:00:00Z', created_at: '2026-10-08T00:00:00Z' },
    // Same published day: the later-created one counts as newer.
    { id: 'new-later', publish_at: '2026-10-07T16:00:00Z', created_at: '2026-09-02T00:00:00Z' },
    // No published date: ordered by created_at instead.
    { id: 'undated', publish_at: null, created_at: '2026-10-06T00:00:00Z' },
  ]
  const ids = (sort) => announcements.sortAnnouncements(rows, sort).map((r) => r.id)
  assert.deepEqual(ids('newest'), ['new-later', 'new', 'undated', 'mid', 'old'], 'by published date, not created_at')
  assert.deepEqual(ids('oldest'), ['old', 'mid', 'undated', 'new', 'new-later'])
  assert.deepEqual(rows.map((r) => r.id), ['mid', 'new', 'old', 'new-later', 'undated'], 'input is not mutated')
})

function saveAction(writes) {
  const db = {
    from: (table) => ({
      insert: async (row) => { writes.push({ table, op: 'insert', row }); return { error: null } },
      update: (row) => ({ eq: async (column, value) => { writes.push({ table, op: 'update', row, where: [column, value] }); return { error: null } } }),
    }),
  }
  return load('app/admin/announcements/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: (to) => { throw Object.assign(new Error('NEXT_REDIRECT'), { to }) } },
    '@/lib/announcements': announcements,
    '@/lib/auth': { requireAdmin: async () => ({}) },
    '@/lib/branding': { getBranding: async () => ({ timezone: 'Asia/Manila' }) },
    '@/lib/datetime': datetime,
    '@/lib/forms': load('lib/forms.ts'),
    '@/lib/supabase/server': { createClient: async () => db },
  })
}

function form(fields) {
  const data = new FormData()
  for (const [k, v] of Object.entries({ title: 'Second semester enrollment', content: 'Enrollment runs Oct 20–31.', date: '2026-10-08', source_label: '', source_url: '', intent: 'draft', ...fields })) data.set(k, v)
  return data
}

test('saving an announcement stores it university-wide and public, with an optional source and no category', async () => {
  const writes = []
  const { saveAnnouncement } = saveAction(writes)
  await assert.rejects(saveAnnouncement(undefined, form({ intent: 'published', source_label: 'Official Facebook page', source_url: FB })), (e) => e.to === '/admin/announcements?tab=published')
  const [{ row }] = writes
  assert.equal(row.status, 'published')
  assert.equal('category' in row, false, 'categories are no longer written, even if a stale form sends one')
  assert.equal(row.source, 'Official Facebook page')
  assert.equal(row.source_url, FB)
  assert.equal(row.department_id, null, 'department targeting is retired')
  assert.equal(row.visibility, 'public')
  assert.equal(row.publish_at, '2026-10-07T16:00:00.000Z', 'midnight in the university time zone')

  await assert.rejects(saveAnnouncement(undefined, form({})), (e) => e.to === '/admin/announcements?tab=draft')
  assert.equal(writes[1].row.status, 'draft')
  assert.equal(writes[1].row.source_url, null)
})

test('invalid source links are rejected before saving', async () => {
  const writes = []
  const { saveAnnouncement } = saveAction(writes)
  const bad = await saveAnnouncement(undefined, form({ source_url: 'javascript:alert(1)' }))
  assert.ok(bad.fieldErrors.source_url)
  assert.equal(writes.length, 0)
})

test('bulk actions change only the selected announcements', async () => {
  const calls = []
  const query = (op, values) => ({
    in: (column, ids) => ({ select: async () => { calls.push({ op, values, column, ids }); return { data: ids.map((id) => ({ id })), error: null } } }),
  })
  const db = { from: () => ({ update: (values) => query('update', values), delete: () => query('delete') }) }
  const { bulkUpdateAnnouncements } = load('app/admin/announcements/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() {} },
    '@/lib/auth': { requireAdmin: async () => ({}) },
    '@/lib/branding': { getBranding: async () => ({ timezone: 'Asia/Manila' }) },
    '@/lib/datetime': datetime,
    '@/lib/forms': load('lib/forms.ts'),
    '@/lib/supabase/server': { createClient: async () => db },
  })
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '22222222-2222-4222-8222-222222222222'
  assert.deepEqual(await bulkUpdateAnnouncements([A, B, A], 'publish'), { ok: true, changed: 2 })
  assert.deepEqual(await bulkUpdateAnnouncements([A], 'draft'), { ok: true, changed: 1 })
  assert.deepEqual(await bulkUpdateAnnouncements([B], 'archive'), { ok: true, changed: 1 })
  assert.deepEqual(await bulkUpdateAnnouncements([A], 'delete'), { ok: true, changed: 1 })
  assert.deepEqual(calls.map((c) => [c.op, c.values?.status, c.ids]), [
    ['update', 'published', [A, B]],
    ['update', 'draft', [A]],
    ['update', 'archived', [B]],
    ['delete', undefined, [A]],
  ])
  assert.equal((await bulkUpdateAnnouncements([], 'publish')).ok, false, 'nothing selected → nothing changes')
  assert.equal((await bulkUpdateAnnouncements(['not-a-uuid'], 'delete')).ok, false)
  assert.equal(calls.length, 4)
})

function answerer(rows) {
  const query = {
    select() { return query }, eq() { return query }, lte() { return query }, or() { return query }, order() { return query }, limit() { return query },
    gte(_column, since) { query.since = since; return query },
    then(resolve) { return Promise.resolve({ data: rows.filter((r) => !query.since || r.publish_at >= query.since), error: null }).then(resolve) },
  }
  return load('lib/campus/announcements.ts', {
    'server-only': {},
    '@/lib/announcements': announcements,
    '@/lib/branding': { getBranding: async () => ({ timezone: 'Asia/Manila' }) },
    '@/lib/campus/announcement-match': match,
    '@/lib/datetime': datetime,
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) },
  })
}

const ROWS = [
  { id: 'a1', title: 'Second semester enrollment schedule', content: 'Enrollment for the second semester runs from October 20 to 31. Bring your clearance.', publish_at: '2026-10-01T00:00:00Z', source: 'Official Facebook page', source_url: FB },
  { id: 'a2', title: 'Scholarship application reminder', content: 'Submit scholarship forms by Friday.', publish_at: '2026-09-28T00:00:00Z', source: null, source_url: null },
]

test('Campus Agent lists matching announcements with title, date and original source', async () => {
  const { answerAnnouncementQuestion } = answerer(ROWS)
  const answer = await answerAnnouncementQuestion(match.detectAnnouncementQuestion('May announcement ba tungkol sa enrollment?'), 'fil')
  assert.equal(answer.status, 'answered')
  assert.match(answer.details, /\*\*Second semester enrollment schedule\*\* \(October 1, 2026\) — /)
  assert.doesNotMatch(answer.details, /Scholarship/)
  assert.deepEqual(answer.sources.map((s) => [s.label, s.url]), [['Second semester enrollment schedule — announced October 1, 2026', FB]])
  assert.equal(answer.link.href, '/app/announcements')

  const scholarship = await answerAnnouncementQuestion(match.detectAnnouncementQuestion('May scholarship announcement?'), 'en')
  assert.equal(scholarship.sources.length, 1)
  assert.equal(scholarship.sources[0].url, undefined, 'no link when the announcement has no source URL')

  const latest = await answerAnnouncementQuestion(match.detectAnnouncementQuestion('Ano latest announcement?'), 'fil', { linkToList: false })
  assert.equal(latest.sources.length, 2)
  assert.equal(latest.link, undefined, 'public answers do not link into the signed-in app')
})

test('Campus Agent never invents a notice when none matches', async () => {
  const { answerAnnouncementQuestion } = answerer(ROWS)
  for (const [question, language] of [['May suspension ba?', 'fil'], ['Ano latest advisory?', 'en']]) {
    const answer = await answerAnnouncementQuestion(match.detectAnnouncementQuestion(question), language)
    assert.equal(answer.status, 'not_found', question)
    assert.equal(answer.details, '', question)
    assert.deepEqual(answer.sources, [], question)
  }
  const none = await answerer([]).answerAnnouncementQuestion(match.detectAnnouncementQuestion('May announcement ba today?'), 'en')
  assert.equal(none.status, 'not_found')
  assert.equal(none.summary, 'There are no published announcements today.')
})

test('general questions get same-topic announcements as context for Claude', async () => {
  const { announcementPassages } = answerer(ROWS)
  const passages = await announcementPassages(match.announcementTopics('Kailan enrollment?'))
  assert.deepEqual(passages.map((p) => p.sectionTitle), ['Second semester enrollment schedule'])
  assert.match(passages[0].content, /^University announcement published October 1, 2026\./)
  assert.equal(passages[0].url, FB)
  assert.deepEqual(await announcementPassages(match.announcementTopics('Paano kumuha ng TOR?')), [])
})

test('Events are retired from the active product', () => {
  for (const file of ['components/admin/admin-sidebar.tsx', 'components/student/student-shell.tsx', 'app/admin/page.tsx', 'lib/ai/campus-agent.ts']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /\/events\b|from\("events"\)/, file)
  }
  for (const route of ['app/admin/events', 'app/app/(shell)/events']) assert.equal(fs.existsSync(path.join(root, route)), false, route)
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261008054953_university_announcements.sql'), 'utf8')
  assert.doesNotMatch(migration, /drop\s+(table|column)|delete\s+from|truncate/i, 'non-destructive')
})
