# Campus Agent — Proposed Database Schema (MVP)

> **Status: APPROVED AND APPLIED (2026-10-01).**
> Applied to `campus-agent` (`yyzawuvpxxgpsgkmmkll`) as the migrations listed in §9; the files are in `supabase/migrations/`.
> One addition was required during rollout — explicit Data API grants (§5.11). The migration files are the source of truth from here on.

Based on: `docs/plan.md`, `docs/skills.md`, `docs/system-spec.md` (§1–100).

**Revision 2 — simplified MVP.** Guiding rules for this revision:

- Department is used to **personalize** (rank) content, never to restrict access.
- Events and announcements have one optional `department_id` filter; empty = university-wide.
- The **student handbook is the primary RAG source**. Other PDFs (memos, policies) use the same pipeline but nothing is built specifically for them.
- Admin features are **simple CRUD**: create, edit, publish/archive, delete. No audit trails, versioning or approval chains.
- A **public landing AI** reads only content marked `public`, enforced by the database.
- No enterprise-level complexity: no RBAC beyond `student` / `admin`, no multi-tenancy, no junction tables or triggers that the MVP doesn't need.

---

## 1. Current Database State (verified via Supabase MCP, 2026-10-01)

Project: `campus-agent` (`yyzawuvpxxgpsgkmmkll`), Postgres 17.

- `public` schema: no tables, no enums. Only function: `public.rls_auto_enable()` (Supabase-managed event trigger that auto-enables RLS on new tables).
- Migrations applied: `20261001142459_enable_pgvector` only.
- Extensions: `vector 0.8.2`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements` (all in `extensions`), `supabase_vault`.
- Storage buckets: none.
- Database timezone: UTC.

---

## 2. What Changed From Revision 1

| Area | Revision 1 | Revision 2 (MVP) |
|---|---|---|
| Event/announcement targeting | `department_id` + `program_id` + `year_level` | **`department_id` only** (null = university-wide) |
| Program ∈ department check | Composite foreign keys on 3 tables | Plain foreign keys; the onboarding form only offers programs of the chosen department |
| Office hours | Structured JSON + note | **Plain text** (e.g. `Mon–Fri, 8:00 AM – 5:00 PM`) — Claude reads it directly |
| Offices | `visibility`, `is_active` | Removed — all office information is public (spec §4.1) |
| Events | `campus_location_id`, `archived` status, `source_document_id` | Removed — `venue` text only; status `draft` / `published` / `cancelled` |
| Announcements | `publish_at` enforced in RLS, required for publish | `publish_at` defaults to now; date filtering happens in the feed query |
| Guideline sources | `guideline_sources` junction table | **`source_document_id` + `source_reference`** columns on `guidelines` |
| Guidelines | `published_at`, `is_ai_generated`, `created_by`, `updated_by` | Removed — `status` + `updated_at` are enough |
| Documents | `checksum_sha256`, `superseded_by`, `page_count`, `uploaded_by`, `processed_at` | Removed — replace an outdated document by archiving it |
| Retrieval function | Document-type filter, returns `superseded_by` | Three inputs: embedding, count, threshold |
| Role in JWT | Custom access token hook | **Removed** — `/admin` layout checks `profiles.role` on the server; nothing to configure in the dashboard |
| Email sync | Insert + update triggers | Copied once at signup |
| Audit columns | `created_by` / `updated_by` on content | Removed |
| Table count | 16 | **15** — exactly the list in spec §70 |

Kept on purpose, because they protect students or the demo:

- Row Level Security on every table, with an `is_admin()` check that reads `profiles.role` live.
- Column-level grants so students can never write their own `role`.
- `visibility` (`public` / `authenticated`) on guidelines, documents, events and announcements — this is what keeps the public landing AI limited to public content.
- `status` with `draft` as default, so AI-drafted guidelines never go live without an admin (spec §61).

---

## 3. Decisions to Confirm

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Embedding model | OpenAI `text-embedding-3-small`, `vector(1536)`, HNSW cosine index. Changing models later only affects `document_chunks.embedding` and `match_document_chunks`. |
| D2 | Visibility | `public` (landing page + public AI) or `authenticated` (signed-in students). Default `authenticated` for guidelines, events and announcements; `public` for documents, so the handbook is available to the public AI unless an admin says otherwise. |
| D3 | Department personalization | Students see all published content; their department's items are **ranked first**. |
| D4 | Making someone admin | Every signup is a `student`. A maintainer promotes admins with one SQL statement. No admin-management screen. |
| D5 | Original PDF files | Only admins can open the `documents` bucket. Students and the public see citations (title, section, page), not the file. |
| D6 | Year level range | `1`–`6` |
| D7 | Display timezone | `Asia/Manila`, stored in `system_settings.timezone`; timestamps are stored as `timestamptz` |

Left for later phases, not in this schema: public-AI rate limiting (spec §80 — planned as a Vercel firewall rate-limit rule on the public AI route, so no table is needed) and restricting signup to the school's email domain (Phase 3 auth settings).

---

## 4. Entity Overview

```
auth.users ──1:1── profiles ──┬── departments ──< programs
                              │        │
                              │        ├──< events          (department_id: null = university-wide)
                              │        └──< announcements   (department_id: null = university-wide)
                              │
                              └──< conversations ──< messages

campus_locations ──< offices ──< guidelines >── guideline_categories
                                     │
                                     ├──< guideline_steps
                                     └── source_document_id ──> documents ──< document_chunks
                                                                 (handbook)    (embedding vector(1536))

system_settings (single row: branding + timezone)
```

---

## 5. Proposed SQL

Applied later as four migrations (see §9). Code is ordered so it runs top to bottom.

### 5.1 Schema, helper and enums

```sql
-- Helpers live in a schema the Supabase API does not expose, so they can't be called as RPC.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create type public.app_role as enum ('student', 'admin');
create type public.content_visibility as enum ('public', 'authenticated');
create type public.publish_status as enum ('draft', 'published', 'archived');      -- guidelines, announcements
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.announcement_category as enum (
  'general', 'academic', 'registrar', 'enrollment',
  'scholarship', 'department', 'campus', 'emergency'
);
create type public.document_type as enum ('handbook', 'memo', 'policy', 'guideline', 'calendar', 'form', 'other');
create type public.document_status as enum ('uploaded', 'processing', 'ready', 'failed', 'archived');
create type public.message_role as enum ('user', 'assistant');
```

### 5.2 Organization, campus and profiles

```sql
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- e.g. 'CCS'
  name        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.programs (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  code          text not null unique,        -- e.g. 'BSIT'
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.campus_locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  building_name text,
  floor         text,
  description   text,
  map_x         numeric(5, 2) check (map_x between 0 and 100),   -- % position on the official map (spec §30)
  map_y         numeric(5, 2) check (map_y between 0 and 100),
  image_path    text,                                            -- path in public-assets bucket
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.offices (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  short_name         text,
  description        text,
  head_name          text,
  head_title         text,
  office_hours       text,                                       -- e.g. 'Mon–Fri, 8:00 AM – 5:00 PM'
  campus_location_id uuid references public.campus_locations (id) on delete set null,
  contact_email      text,
  contact_phone      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.app_role not null default 'student',
  email         text,                                           -- copied from auth.users at signup
  full_name     text,
  student_id    text unique,
  department_id uuid references public.departments (id) on delete set null,
  program_id    uuid references public.programs (id) on delete set null,
  year_level    smallint check (year_level between 1 and 6),
  avatar_url    text,
  onboarded_at  timestamptz,                                    -- null until onboarding is completed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 5.3 Knowledge base and handbook RAG

```sql
create table public.guideline_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,                                -- e.g. 'Student Handbook 2026'
  document_type    public.document_type not null default 'handbook',
  file_path        text not null unique,                         -- path in documents bucket
  file_name        text not null,
  mime_type        text not null check (mime_type = 'application/pdf'),
  file_size        bigint not null check (file_size > 0),
  status           public.document_status not null default 'uploaded',
  processing_error text,                                         -- shown with "Processing Failed" + retry (spec §83)
  visibility       public.content_visibility not null default 'public',
  effective_date   date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.document_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents (id) on delete cascade,
  chunk_index   integer not null check (chunk_index >= 0),
  content       text not null,
  page_number   integer check (page_number > 0),
  section_title text,                                            -- e.g. 'Section 5.3 — Incomplete Grades'
  embedding     extensions.vector(1536) not null,                -- D1
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table public.guidelines (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  slug                  text not null unique,
  description           text,
  requirements          text[] not null default '{}',
  related_forms         text[] not null default '{}',
  category_id           uuid not null references public.guideline_categories (id) on delete restrict,
  responsible_office_id uuid references public.offices (id) on delete set null,
  source_document_id    uuid references public.documents (id) on delete set null,
  source_reference      text,                                    -- e.g. 'Section 5.3, p. 42'
  status                public.publish_status not null default 'draft',      -- AI drafts start here (spec §61)
  visibility            public.content_visibility not null default 'authenticated',
  effective_date        date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.guideline_steps (
  id           uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guidelines (id) on delete cascade,
  step_number  integer not null check (step_number > 0),
  title        text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (guideline_id, step_number)
);
```

### 5.4 Events and announcements

```sql
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  venue         text,
  department_id uuid references public.departments (id) on delete set null,   -- null = university-wide
  visibility    public.content_visibility not null default 'authenticated',
  status        public.event_status not null default 'draft',
  source        text,                                          -- e.g. 'Calendar of Activities 2026–2027'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  category      public.announcement_category not null default 'general',
  department_id uuid references public.departments (id) on delete set null,   -- null = university-wide
  visibility    public.content_visibility not null default 'authenticated',
  status        public.publish_status not null default 'draft',
  publish_at    timestamptz not null default now(),
  expires_at    timestamptz,
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (expires_at is null or expires_at > publish_at)
);
```

### 5.5 Conversations and settings

```sql
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()               -- bumped on each new message; orders Recent Conversations
);

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  role              public.message_role not null,
  content           text not null,
  response_metadata jsonb,                                     -- structured CampusAgentResponse + sources
  created_at        timestamptz not null default now()
);

create table public.system_settings (
  id                    boolean primary key default true check (id),   -- single row
  university_name       text,
  university_short_name text,
  assistant_name        text not null default 'Campus Agent',
  logo_path             text,                                           -- path in public-assets bucket
  primary_brand_color   text check (primary_brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone              text not null default 'Asia/Manila',            -- D7
  updated_at            timestamptz not null default now()
);

insert into public.system_settings (id) values (true);
```

### 5.6 Indexes

Every foreign key is indexed (Supabase advisor requirement), plus the main read paths.

```sql
create index programs_department_id_idx           on public.programs (department_id);
create index offices_campus_location_id_idx       on public.offices (campus_location_id);
create index profiles_department_id_idx           on public.profiles (department_id);
create index profiles_program_id_idx              on public.profiles (program_id);

create index guidelines_category_id_idx           on public.guidelines (category_id);
create index guidelines_responsible_office_id_idx on public.guidelines (responsible_office_id);
create index guidelines_source_document_id_idx    on public.guidelines (source_document_id);
create index document_chunks_embedding_idx        on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create index events_starts_at_idx                 on public.events (starts_at);
create index events_department_id_idx             on public.events (department_id);
create index announcements_publish_at_idx         on public.announcements (publish_at desc);
create index announcements_department_id_idx      on public.announcements (department_id);

create index conversations_user_id_updated_at_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_id_created_idx on public.messages (conversation_id, created_at);
```

### 5.7 Triggers

```sql
-- updated_at on every table that has it
do $$
declare
  t text;
begin
  foreach t in array array[
    'departments', 'programs', 'campus_locations', 'offices', 'profiles',
    'guideline_categories', 'documents', 'guidelines', 'guideline_steps',
    'events', 'announcements', 'conversations', 'system_settings'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- Every signup gets a student profile (D4). Role is never read from signup data.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- A new message moves its conversation to the top of Recent Conversations.
create function private.touch_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger touch_conversation after insert on public.messages
  for each row execute function private.touch_conversation();
```

### 5.8 Admin check and Row Level Security

```sql
-- The single source of truth for admin access, used by every admin policy.
-- security definer so it can read profiles without recursing into profiles' own RLS.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

do $$
declare
  t text;
begin
  -- RLS on every table
  foreach t in array array[
    'departments', 'programs', 'campus_locations', 'offices', 'profiles',
    'guideline_categories', 'documents', 'document_chunks', 'guidelines', 'guideline_steps',
    'events', 'announcements', 'conversations', 'messages', 'system_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Simple admin CRUD on all official content (spec §77)
  foreach t in array array[
    'departments', 'programs', 'campus_locations', 'offices',
    'guideline_categories', 'documents', 'document_chunks', 'guidelines', 'guideline_steps',
    'events', 'announcements', 'system_settings'
  ] loop
    execute format('create policy "Admins can insert %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- ---------- Open directory data: everyone, including the public landing page ----------
create policy "Anyone can read departments"          on public.departments          for select to anon, authenticated using (true);
create policy "Anyone can read programs"             on public.programs             for select to anon, authenticated using (true);
create policy "Anyone can read campus locations"     on public.campus_locations     for select to anon, authenticated using (true);
create policy "Anyone can read offices"              on public.offices              for select to anon, authenticated using (true);
create policy "Anyone can read guideline categories" on public.guideline_categories for select to anon, authenticated using (true);
create policy "Anyone can read system settings"      on public.system_settings      for select to anon, authenticated using (true);

-- ---------- Published content: public visitors see `public` items; students see everything published;
--            admins also see drafts. Department never restricts access (D3). ----------
create policy "Public reads public guidelines" on public.guidelines
  for select to anon using (status = 'published' and visibility = 'public');
create policy "Signed-in users read guidelines" on public.guidelines
  for select to authenticated using (status = 'published' or (select private.is_admin()));

create policy "Public reads public events" on public.events
  for select to anon using (status <> 'draft' and visibility = 'public');
create policy "Signed-in users read events" on public.events
  for select to authenticated using (status <> 'draft' or (select private.is_admin()));

create policy "Public reads public announcements" on public.announcements
  for select to anon using (status = 'published' and visibility = 'public');
create policy "Signed-in users read announcements" on public.announcements
  for select to authenticated using (status = 'published' or (select private.is_admin()));

create policy "Public reads public documents" on public.documents
  for select to anon using (status = 'ready' and visibility = 'public');
create policy "Signed-in users read documents" on public.documents
  for select to authenticated using (status = 'ready' or (select private.is_admin()));

-- Child rows follow their parent (the subquery is filtered by the parent's own RLS).
create policy "Read steps of visible guidelines" on public.guideline_steps
  for select to anon, authenticated
  using (exists (select 1 from public.guidelines g where g.id = guideline_steps.guideline_id));

create policy "Read chunks of visible documents" on public.document_chunks
  for select to anon, authenticated
  using (exists (select 1 from public.documents d where d.id = document_chunks.document_id));

-- ---------- Profiles (spec §73) ----------
create policy "Users read own profile; admins read all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Students may only write their onboarding fields — never role or email.
-- Profiles are created by the signup trigger and removed when the auth user is deleted.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, student_id, department_id, program_id, year_level, avatar_url, onboarded_at)
  on public.profiles to authenticated;

-- ---------- Conversations and messages: owner only (spec §74–75) ----------
create policy "Users read own conversations" on public.conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own conversations" on public.conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own conversations" on public.conversations
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete own conversations" on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Users read messages in own conversations" on public.messages
  for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id));
create policy "Users add messages to own conversations" on public.messages
  for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = messages.conversation_id));
```

### 5.9 Handbook retrieval function (spec §48)

```sql
-- security invoker: results are filtered by the caller's RLS. The public landing AI runs as `anon`
-- and can only ever retrieve chunks of `public` documents; signed-in students get all ready documents.
create function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count     integer default 6,
  min_similarity  double precision default 0.3            -- starting point; tune with real handbook questions
)
returns table (
  chunk_id       uuid,
  document_id    uuid,
  document_title text,
  document_type  public.document_type,
  effective_date date,
  section_title  text,
  page_number    integer,
  content        text,
  similarity     double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    d.id,
    d.title,
    d.document_type,
    d.effective_date,
    c.section_title,
    c.page_number,
    c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding)
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.status = 'ready'
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
```

### 5.10 Storage

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents',     'documents',     false, 26214400, array['application/pdf']),                       -- 25 MB, admin-only (D5)
  ('public-assets', 'public-assets', true,  5242880,  array['image/png', 'image/jpeg', 'image/webp']);  -- 5 MB, logo + campus map

create policy "Admins manage official documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and (select private.is_admin()))
  with check (bucket_id = 'documents' and (select private.is_admin()));

-- Files in public-assets are served by public URL; only admins upload, replace or delete them.
create policy "Admins manage public assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and (select private.is_admin()))
  with check (bucket_id = 'public-assets' and (select private.is_admin()));
```

SVG is not allowed in `public-assets` because SVG files can contain scripts.

### 5.11 Data API grants (added during rollout)

This Supabase project does **not** give `anon` / `authenticated` table privileges on new tables by default (they only receive `REFERENCES`, `TRIGGER`, `TRUNCATE`), so RLS policies alone would leave every table unreachable through the API. Each table therefore gets explicit, minimal grants that match the access matrix in §6; RLS still decides which rows are visible.

```sql
-- core (migration grant_core_api_access)
grant select on public.departments, public.programs, public.campus_locations, public.offices to anon, authenticated;
grant insert, update, delete on public.departments, public.programs, public.campus_locations, public.offices to authenticated;
grant select on public.profiles to authenticated;   -- update stays column-limited (§5.8)

-- knowledge base (end of create_knowledge_base)
grant select on public.guideline_categories, public.documents, public.document_chunks,
  public.guidelines, public.guideline_steps to anon, authenticated;
grant insert, update, delete on public.guideline_categories, public.documents, public.document_chunks,
  public.guidelines, public.guideline_steps to authenticated;
grant execute on function public.match_document_chunks(extensions.vector, integer, double precision) to anon, authenticated;

-- events, announcements, conversations, settings (end of create_events_announcements_conversations)
grant select on public.events, public.announcements, public.system_settings to anon, authenticated;
grant insert, update, delete on public.events, public.announcements, public.system_settings to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
```

`anon` has no privileges at all on `profiles`, `conversations` and `messages`. `service_role` received no table grants because no MVP flow uses a secret key.

---

## 6. Access Matrix

| Data | Public visitor / landing AI (`anon`) | Student | Admin |
|---|---|---|---|
| departments, programs, campus locations, offices, guideline categories, settings | read | read | read + write |
| guidelines + steps | published + `public` | all published | all + write |
| events | published/cancelled + `public` | all published/cancelled (every department) | all + write |
| announcements | published + `public` | all published (every department) | all + write |
| documents + chunks (handbook) | ready + `public` | all ready | all + write |
| profiles | — | own; onboarding fields only | read all |
| conversations, messages | — (public AI keeps no history) | own only | — |
| storage `documents` | — | — | full |
| storage `public-assets` | public URLs | public URLs | full |

Route protection: `proxy.ts` refreshes the session and may send signed-out visitors away from `/app` and `/admin` (a quick check only, no role lookup). The `/app` layout requires a signed-in user; the `/admin` layout and every admin server action check `profiles.role = 'admin'` on the server. RLS is the final safeguard if any of those are bypassed.

---

## 7. How the MVP Requirements Are Met

**Department personalization, not restriction.** Students can read every published event and announcement. Their department's items come first, then university-wide ones, then other departments:

```sql
-- illustrative feed query, not part of the migration
select *
from public.events
where status = 'published' and starts_at >= now()
order by
  case
    when department_id = :student_department_id then 0
    when department_id is null then 1
    else 2
  end,
  starts_at
limit 10;
```

The Events and Announcements pages use the same column for a simple filter: **All / My department / University-wide / a chosen department**. Announcement feeds also hide expired items with `expires_at is null or expires_at > now()`.

**Handbook as the primary RAG source.** An admin uploads the handbook PDF → `documents` row (`document_type = 'handbook'`, `visibility = 'public'`) → text is chunked with `page_number` and `section_title` → embeddings go into `document_chunks`. Citations such as "Student Handbook 2026 — Section 5.3, p. 42" come straight from those columns. Other PDFs use the same path. To replace an outdated handbook, upload the new one and archive the old one; archived documents disappear from retrieval.

**Public landing AI.** The public AI route uses the Supabase client **without a user session** (`anon`). RLS limits it to public guidelines, events, announcements and documents plus the open directory data, and `match_document_chunks` applies the same limit to the handbook. No conversation is stored for public visitors.

**Simple admin CRUD.** One admin role, one `is_admin()` check, the same insert/update/delete rule on every content table. Publishing = setting `status` to `published`. Editing guide steps = replace the guideline's steps.

**AI drafts never auto-publish (spec §61).** Everything the Admin AI creates is inserted with the default `status = 'draft'`.

**No secret key needed.** Admin writes, including handbook ingestion, run under the admin's own session and are authorized by RLS. The only server-side secrets are the Claude and OpenAI keys.

---

## 8. Deliberately Not Included

- Restricting content by department, program or year level.
- Program and year-level targeting for events/announcements.
- Admin roles beyond Super Admin, audit trails, version history, approval workflows.
- Document version chains, duplicate-upload detection, OCR.
- A table linking guidelines to multiple sources (one source document per guideline in the MVP).
- A rate-limit table (spec §80 — Vercel rate-limit rule instead).
- Multi-tenancy / multiple schools.

Each of these can be added later with a migration without reworking the tables above.

---

## 9. Applied Migrations

Each was applied one at a time and followed by a state check and Supabase's security and performance advisors.

| Version | Name | Contents |
|---|---|---|
| `20261001142459` | `enable_pgvector` | (Phase 1) `vector` extension |
| `20261001145758` | `create_core_schema` | §5.1, §5.2, related indexes, signup trigger, `is_admin`, RLS for core tables |
| `20261001150001` | `grant_core_api_access` | §5.11 grants for the core tables (added during rollout) |
| `20261001150028` | `create_knowledge_base` | §5.3, indexes, RLS, `match_document_chunks`, grants |
| `20261001150112` | `create_events_announcements_conversations` | §5.4, §5.5, indexes, triggers, RLS, settings row, grants |
| `20261001150131` | `create_storage_buckets` | §5.10 |

TypeScript types were generated into `lib/supabase/database.types.ts` and are used by the browser, server and proxy clients.

---

## 10. Validation Performed

All 10 SQL blocks in §5 were executed top-to-bottom in a local, throwaway, in-memory Postgres (PGlite 0.5.8 — Postgres 18.3 + pgvector 0.8.1) with minimal stand-ins for Supabase's `auth` and `storage` schemas and the `anon` / `authenticated` roles. **Nothing was run against the Supabase project.**

Result: all SQL applied without errors — 15 tables, RLS on every one — and **63 / 63 role-based tests passed**, including:

- Signup creates a `student` profile even when signup data claims `"role": "admin"`; students cannot change their own `role` or `email`.
- Simple admin CRUD: admins create, publish (one update), and delete content; new guidelines default to `draft`. Students and public visitors cannot write official content.
- Department personalization: students see events from **every** department; the feed query ranks own department → university-wide → other departments; department and university-wide filters work.
- Public landing AI (`anon`): sees only `public` published guidelines, events and announcements, office hours and locations, and retrieves only chunks of `public` ready documents.
- Handbook retrieval returns section title, page number and similarity for citations; archived handbooks and not-yet-processed uploads are excluded; unrelated queries fall below the threshold.
- Conversations are private to their owner (other students and admins cannot read or post); `system` messages are rejected.
- Only admins can upload to or list the `documents` bucket; admins can rename the assistant (white-label).
- Deleting an auth user removes their profile, conversations and messages.

Limits of this check: the auth/storage stand-ins are simplified, and the real project runs Postgres 17.

**Before applying**, the final migration files were re-run locally with the stand-in database configured like this project (no default table grants): 63 / 63 passed, and a structural comparison against §5 found 0 differences in 421 schema objects (columns, constraints, indexes, policies, triggers, functions).

**After applying**, read-only requests through the live Data API with the publishable key confirmed: public visitors can read every content table and `system_settings`; `profiles`, `conversations` and `messages` return `permission denied`; `match_document_chunks` is callable; `private.is_admin` is not exposed (404). Security advisor: no findings for the new schema. Performance advisor: only "unused index" notices (expected on empty tables).
