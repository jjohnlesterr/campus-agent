-- Admin → Knowledge Library: sources and their reviewed knowledge sections in one module.
-- Additive only: no tables, rows or columns are removed.
--
-- 1. documents gain an admin-only AI overview (summary, key topics), the last analysis
--    time, and who uploaded them.
-- 2. guidelines (knowledge sections) gain `content`: the reviewed text Campus Agent
--    answers from. Existing sections are backfilled verbatim from their linked
--    extracted text, so current answers keep the same wording and page citations.
-- 3. Student retrieval moves from raw extracted text of every Ready document to
--    Published sections only (search_knowledge). Drafts and archived sections are
--    never searched. search_document_chunks is kept, unused, for rollback.

-- ---------- Sources ----------
alter table public.documents
  add column summary     text,
  add column key_topics  text[] not null default '{}',
  add column analyzed_at timestamptz,
  add column uploaded_by uuid references public.profiles (id) on delete set null default auth.uid();

create index documents_uploaded_by_idx on public.documents (uploaded_by);

-- ---------- Knowledge sections ----------
alter table public.guidelines add column content text;

update public.guidelines g
set content = (
  select string_agg(c.content, E'\n\n' order by c.chunk_index)
  from public.document_chunks c
  where c.document_id = g.source_document_id
    and c.id::text in (select jsonb_array_elements_text(g.source_reference::jsonb -> 'chunkIds'))
)
where g.content is null
  and g.source_document_id is not null
  and g.source_reference like '{%';

alter table public.guidelines
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(content, '')), 'B')
  ) stored;

create index guidelines_search_vector_idx on public.guidelines using gin (search_vector);

-- Standard categories for AI suggestions and manual entries (reference data, not content).
insert into public.guideline_categories (name, slug, sort_order) values
  ('Enrollment', 'enrollment', 10),
  ('Academic Policies', 'academic-policies', 20),
  ('Grading', 'grading', 30),
  ('Scholarships', 'scholarships', 40),
  ('Graduation', 'graduation', 50),
  ('Student Conduct', 'student-conduct', 60),
  ('Student Services', 'student-services', 70),
  ('Fees and Payments', 'fees-and-payments', 80),
  ('Academic Calendar', 'academic-calendar', 90),
  ('Admissions', 'admissions', 100),
  ('General Information', 'general-information', 110)
on conflict do nothing;

-- ---------- Retrieval ----------
-- Title of a section's source for citations. Students cannot read documents that are
-- being re-analyzed (status processing/failed), but the Published section must keep its
-- citation meanwhile. Returns null for archived sources (their sections are not used)
-- and only for sources that have at least one Published section.
create function private.knowledge_source_title(source_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.title
  from public.documents d
  where d.id = source_id
    and d.status <> 'archived'
    and exists (
      select 1 from public.guidelines g
      where g.source_document_id = d.id and g.status = 'published'
    );
$$;

revoke all on function private.knowledge_source_title(uuid) from public;
grant execute on function private.knowledge_source_title(uuid) to anon, authenticated;

-- Published knowledge sections matching ANY meaningful word of the question (same
-- query construction as search_document_chunks). security invoker: guideline RLS
-- applies, so anonymous callers only see Published + public sections.
create function public.search_knowledge(query_text text, match_count integer default 5)
returns table (
  section_id       uuid,
  title            text,
  source_id        uuid,
  source_title     text,
  source_reference text,
  content          text,
  rank             real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select to_tsquery(
      'english',
      array_to_string(tsvector_to_array(to_tsvector('english', coalesce(query_text, ''))), ' | ')
    ) as query
  )
  select g.id, g.title, g.source_document_id, s.title, g.source_reference,
         coalesce(nullif(g.content, ''), g.description, ''),
         ts_rank_cd(g.search_vector, q.query) as rank
  from public.guidelines g
  cross join q
  left join lateral (select private.knowledge_source_title(g.source_document_id) as title) s on true
  where g.status = 'published'
    and numnode(q.query) > 0
    and g.search_vector @@ q.query
    and (g.source_document_id is null or s.title is not null)
  order by rank desc, g.title
  limit least(greatest(match_count, 1), 20);
$$;

grant execute on function public.search_knowledge(text, integer) to anon, authenticated;
