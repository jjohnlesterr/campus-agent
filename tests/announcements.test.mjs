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
const sources = load('lib/sources.ts')
const announcementImages = load('lib/announcement-images.ts', { '@/lib/sources': sources })
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
  assert.equal(announcements.announcementSort('newest'), 'newest')
  assert.equal(announcements.announcementSort('bogus'), 'manual', 'manual order by default')
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

function saveAction(writes, { image = { size: 1000, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, removed = [], current = null, firstOrder = 3 } = {}) {
  const db = {
    from: (table) => ({
      insert: async (row) => { writes.push({ table, op: 'insert', row }); return { error: null } },
      update: (row) => ({ eq: async (column, value) => { writes.push({ table, op: 'update', row, where: [column, value] }); return { error: null } } }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { image_url: current } }) }),
        // The current first announcement in the manual order (new ones go above it).
        order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { sort_order: firstOrder } }) }) }),
      }),
    }),
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/public-assets/${path}` } }),
        download: async () => ({ data: { size: image.size, slice: () => ({ arrayBuffer: async () => new Uint8Array(image.bytes).buffer }) }, error: null }),
        remove: async (paths) => { removed.push(...paths); return { error: null } },
      }),
    },
  }
  return load('app/admin/announcements/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: (to) => { throw Object.assign(new Error('NEXT_REDIRECT'), { to }) } },
    '@/lib/announcements': announcements,
    '@/lib/announcement-images': announcementImages,
    '@/lib/announcement-scopes': load('lib/announcement-scopes.ts'),
    '@/lib/auth': { requireAdmin: async () => ({}) },
    '@/lib/branding': { getBranding: async () => ({ timezone: 'Asia/Manila' }) },
    '@/lib/datetime': datetime,
    '@/lib/forms': load('lib/forms.ts'),
    '@/lib/sources': sources,
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
  await assert.rejects(saveAnnouncement(undefined, form({ intent: 'published', source_label: 'Official Facebook page', source_url: FB })), (e) => e.to === '/admin/announcements?tab=published&saved=published')
  const [{ row }] = writes
  assert.equal(row.status, 'published')
  assert.equal('category' in row, false, 'categories are no longer written, even if a stale form sends one')
  assert.equal(row.source, 'Official Facebook page')
  assert.equal(row.source_url, FB)
  assert.equal(row.department_id, null, 'department targeting is retired')
  assert.equal(row.visibility, 'public')
  assert.equal(row.publish_at, '2026-10-07T16:00:00.000Z', 'midnight in the university time zone')

  await assert.rejects(saveAnnouncement(undefined, form({})), (e) => e.to === '/admin/announcements?tab=draft&saved=draft')
  assert.equal(writes[1].row.status, 'draft')
  assert.equal(writes[1].row.source_url, null)
  assert.equal('image_url' in writes[1].row, false, 'no image change: the current image is kept')
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
    '@/lib/announcement-images': announcementImages,
    '@/lib/announcement-scopes': load('lib/announcement-scopes.ts'),
    '@/lib/sources': sources,
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
    select(columns) { query.columns = columns; return query }, eq(column, value) { (query.eqs ??= []).push([column, value]); return query }, lte() { return query }, or() { return query }, order() { return query },
    limit(n) { query.limitValue = n; return query }, is(column, value) { (query.iss ??= []).push([column, value]); return query },
    gte(_column, since) { query.since = since; return query },
    then(resolve) { return Promise.resolve({ data: rows.filter((r) => !query.since || r.publish_at >= query.since), error: null }).then(resolve) },
  }
  const loaded = load('lib/campus/announcements.ts', {
    'server-only': {},
    '@/lib/announcements': announcements,
    '@/lib/branding': { getBranding: async () => ({ timezone: 'Asia/Manila' }) },
    '@/lib/campus/announcement-match': match,
    '@/lib/announcement-scopes': load('lib/announcement-scopes.ts'),
    '@/lib/datetime': datetime,
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) },
  })
  return { ...loaded, query }
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

const UPLOAD = 'announcements/33333333-3333-4333-8333-333333333333.png'
const ID = '44444444-4444-4444-8444-444444444444'

test('a new announcement image is verified, saved as its public URL, and replaces the old file only after saving', async () => {
  const writes = []
  const removed = []
  const old = 'https://project.supabase.co/storage/v1/object/public/public-assets/announcements/55555555-5555-4555-8555-555555555555.jpg'
  const { saveAnnouncement } = saveAction(writes, { removed, current: old })
  await assert.rejects(saveAnnouncement(undefined, form({ id: ID, image: UPLOAD })), (e) => e.to.startsWith('/admin/announcements?tab=draft'))
  assert.equal(writes[0].row.image_url, `https://project.supabase.co/storage/v1/object/public/public-assets/${UPLOAD}`)
  assert.deepEqual(removed, ['announcements/55555555-5555-4555-8555-555555555555.jpg'])
})

test('removing the image clears it; a non-image upload is rejected and discarded', async () => {
  const writes = []
  const { saveAnnouncement } = saveAction(writes)
  await assert.rejects(saveAnnouncement(undefined, form({ image: 'remove' })), (e) => e.to.startsWith('/admin/announcements'))
  assert.equal(writes[0].row.image_url, null)

  const removed = []
  const bad = saveAction([], { removed, image: { size: 1000, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] } })
  const result = await bad.saveAnnouncement(undefined, form({ image: UPLOAD }))
  assert.ok(result.fieldErrors.image)
  assert.deepEqual(removed, [UPLOAD], 'the rejected upload is removed from Storage')
})

test('source label placeholder uses the configured university name', () => {
  assert.equal(announcements.sourceLabelPlaceholder('Example University'), 'e.g. Example University Official Facebook')
  assert.equal(announcements.sourceLabelPlaceholder(null), 'e.g. Official university Facebook page')
})

test('the image crop position is saved (default centered; out-of-range values fall back to center)', async () => {
  const writes = []
  const { saveAnnouncement } = saveAction(writes)
  await assert.rejects(saveAnnouncement(undefined, form({})), (e) => e.to.startsWith('/admin/announcements'))
  assert.deepEqual([writes[0].row.image_position_x, writes[0].row.image_position_y], [50, 50])
  await assert.rejects(saveAnnouncement(undefined, form({ image_position_x: '12.345', image_position_y: '80' })), (e) => e.to.startsWith('/admin/announcements'))
  assert.deepEqual([writes[1].row.image_position_x, writes[1].row.image_position_y], [12.35, 80])
  await assert.rejects(saveAnnouncement(undefined, form({ image_position_x: '250', image_position_y: 'x' })), (e) => e.to.startsWith('/admin/announcements'))
  assert.deepEqual([writes[2].row.image_position_x, writes[2].row.image_position_y], [50, 50], 'invalid values fall back to center')
})

test('a new announcement goes to the top of the manual order; editing keeps its place', async () => {
  const writes = []
  const { saveAnnouncement } = saveAction(writes, { firstOrder: 3 })
  await assert.rejects(saveAnnouncement(undefined, form({})), (e) => e.to.startsWith('/admin/announcements'))
  assert.equal(writes[0].op, 'insert')
  assert.equal(writes[0].row.sort_order, 2, 'above the current first (3)')
  await assert.rejects(saveAnnouncement(undefined, form({ id: ID })), (e) => e.to.startsWith('/admin/announcements'))
  assert.equal('sort_order' in writes[1].row, false, 'an edit never changes the manual order')
})

test('manual order sorts by sort_order; rows without one follow, newest first', () => {
  const rows = [
    { id: 'b', sort_order: 2, publish_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
    { id: 'none', sort_order: null, publish_at: '2026-10-09T00:00:00Z', created_at: '2026-10-09T00:00:00Z' },
    { id: 'a', sort_order: 1, publish_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
  ]
  assert.deepEqual(announcements.sortAnnouncements(rows, 'manual').map((r) => r.id), ['a', 'b', 'none'])
  assert.deepEqual(announcements.sortAnnouncements(rows, 'newest').map((r) => r.id), ['none', 'b', 'a'], 'date sorts ignore the manual order')
})

test('announcement answers follow the asked-for audience: all relevant, CECT, or University-wide', async () => {
  const rows = [
    { id: 'u1', title: 'University foundation week', content: 'Foundation week starts Monday.', publish_at: '2026-10-05T00:00:00Z', source: null, source_url: null, departments: null },
    { id: 'c1', title: 'CECT programming contest', content: 'Join the CECT contest.', publish_at: '2026-10-04T00:00:00Z', source: null, source_url: null, departments: { code: 'CECT' } },
    { id: 'o1', title: 'Another college notice', content: 'Not enabled yet.', publish_at: '2026-10-03T00:00:00Z', source: null, source_url: null, departments: { code: 'CAS' } },
  ]
  const { answerAnnouncementQuestion } = answerer(rows)
  const ask = (text) => answerAnnouncementQuestion(match.detectAnnouncementQuestion(text, ['CECT']), 'en')
  const titles = (answer) => answer.sources.map((s) => s.sectionTitle)
  assert.deepEqual(titles(await ask('What are the latest announcements?')), ['University foundation week', 'CECT programming contest'])
  assert.deepEqual(titles(await ask('What are the latest CECT announcements?')), ['CECT programming contest'])
  assert.deepEqual(titles(await ask('What are the latest university announcements?')), ['University foundation week'])
  assert.match((await ask('What are the latest CECT announcements?')).summary, /latest CECT announcements/)
})

test('the five announcement queries use the stored category, not the title text', async () => {
  // The CECT notice's title doesn't say "CECT", and the university one does: only the stored
  // category (departments.code) decides which audience each query gets.
  const rows = [
    { id: 'u1', title: 'CECT building closed for repairs (university notice)', content: 'Campus-wide notice.', publish_at: '2026-10-06T00:00:00Z', source: 'WUP Official Facebook', source_url: FB, departments: null },
    { id: 'c1', title: 'Programming contest registration', content: 'Sign up by Friday.', publish_at: '2026-10-05T00:00:00Z', source: 'CECT Facebook page', source_url: 'https://www.facebook.com/WUPCECT/posts/1', departments: { code: 'CECT' } },
  ]
  const { answerAnnouncementQuestion } = answerer(rows)
  const ask = async (text, language = 'en') => {
    const question = match.detectAnnouncementQuestion(text, ['CECT'])
    assert.ok(question, `"${text}" is an announcement question`)
    return answerAnnouncementQuestion(question, language)
  }
  const ids = (answer) => answer.sources.map((s) => s.sectionTitle)

  assert.deepEqual(ids(await ask('What are the latest announcements?')), [rows[0].title, rows[1].title], '1: both categories, newest first')
  assert.deepEqual(ids(await ask('What are the latest CECT announcements?')), [rows[1].title], '2: CECT only')
  assert.deepEqual(ids(await ask('What are the latest university announcements?')), [rows[0].title], '3: University-wide only')
  assert.deepEqual(ids(await ask('May announcement ba ang CECT?', 'fil')), [rows[1].title], '4: Tagalog, CECT only')
  const fil = await ask('Ano latest announcement ng CECT?', 'fil')
  assert.deepEqual(ids(fil), [rows[1].title], '5: Tagalog, CECT only')
  assert.match(fil.summary, /pinakabagong CECT announcement/)
  // Source label, source URL and published date are kept.
  assert.equal(fil.sources[0].url, 'https://www.facebook.com/WUPCECT/posts/1')
  assert.match(fil.details, /\*\*Programming contest registration\*\* \(October 5, 2026 · CECT\)/)
})

test('announcement answers show 3 by default, or the number asked for, fetched with a database limit', async () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: `n${i}`, title: `Notice ${i + 1}`, content: `Text of notice ${i + 1}. More details follow.`,
    publish_at: `2026-10-${String(20 - i).padStart(2, '0')}T00:00:00Z`, source: null, source_url: null, departments: i % 2 ? { code: 'CECT' } : null,
  }))
  const run = async (text) => {
    const answerer2 = answerer(rows)
    const answer = await answerer2.answerAnnouncementQuestion(match.detectAnnouncementQuestion(text, ['CECT']), 'en')
    return { answer, query: answerer2.query }
  }

  const latest = await run('What are the latest announcements?')
  assert.equal(latest.answer.sources.length, 3, 'max 3 by default')
  assert.deepEqual(latest.answer.sources.map((s) => s.sectionTitle), ['Notice 1', 'Notice 2', 'Notice 3'], 'newest first')
  assert.equal(latest.answer.details.split('\n').length, 3, 'one concise line per shown announcement')
  assert.doesNotMatch(latest.answer.details, /More details follow/, 'a snippet, not the full body')
  assert.equal(latest.answer.link.href, '/app/announcements', 'View all announcements is kept')
  assert.ok(latest.query.limitValue <= 10, 'only a few rows are fetched')

  const cect = await run('What are the latest CECT announcements?')
  assert.equal(cect.query.limitValue, 3, 'the limit is applied in the query')
  assert.ok(cect.query.columns.includes('departments!inner(code)'))
  assert.deepEqual(cect.query.eqs.find(([c]) => c === 'departments.code'), ['departments.code', 'CECT'], 'CECT is filtered in the query')

  const university = await run('What are the latest university announcements?')
  assert.deepEqual(university.query.iss, [['department_id', null]], 'University-wide is filtered in the query')

  assert.equal((await run('Show me 5 CECT announcements')).answer.sources.length, 5)
  assert.equal((await run('Give me the latest 2 announcements')).answer.sources.length, 2)
  assert.equal((await run('Show more announcements')).answer.sources.length, 6)
  assert.equal((await run('Show all announcements')).answer.sources.length, 10, 'show all still stops at 10, with the View all link')
})
