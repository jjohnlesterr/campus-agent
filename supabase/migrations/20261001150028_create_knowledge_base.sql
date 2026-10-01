-- Campus Agent MVP schema, migration 2 of 4: knowledge base and handbook RAG.
-- Source: docs/schema-proposal.md (revision 2) §5.3, §5.6–§5.9.

-- ---------- Tables ----------
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
  embedding     extensions.vector(1536) not null,                -- OpenAI text-embedding-3-small
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

-- ---------- Indexes ----------
create index guidelines_category_id_idx           on public.guidelines (category_id);
create index guidelines_responsible_office_id_idx on public.guidelines (responsible_office_id);
create index guidelines_source_document_id_idx    on public.guidelines (source_document_id);
create index document_chunks_embedding_idx        on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------- Triggers ----------
do $$
declare
  t text;
begin
  foreach t in array array['guideline_categories', 'documents', 'guidelines', 'guideline_steps'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------- Row Level Security ----------
do $$
declare
  t text;
begin
  foreach t in array array['guideline_categories', 'documents', 'document_chunks', 'guidelines', 'guideline_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    -- Simple admin CRUD on official content (spec §77)
    execute format('create policy "Admins can insert %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

create policy "Anyone can read guideline categories" on public.guideline_categories
  for select to anon, authenticated using (true);

-- Public visitors see `public` items; students see everything published; admins also see drafts.
create policy "Public reads public guidelines" on public.guidelines
  for select to anon using (status = 'published' and visibility = 'public');
create policy "Signed-in users read guidelines" on public.guidelines
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

-- ---------- Handbook retrieval (spec §48) ----------
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

-- ---------- Data API access (no default grants in this project; RLS still filters rows) ----------
grant select on public.guideline_categories, public.documents, public.document_chunks,
  public.guidelines, public.guideline_steps to anon, authenticated;
grant insert, update, delete on public.guideline_categories, public.documents, public.document_chunks,
  public.guidelines, public.guideline_steps to authenticated;    -- admin-only via RLS
grant execute on function public.match_document_chunks(extensions.vector, integer, double precision)
  to anon, authenticated;
