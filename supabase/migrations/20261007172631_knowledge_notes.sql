-- Knowledge Notes: one large, human-readable note per source (or a standalone manual
-- note), published as a whole. Publishing splits the note into hidden retrieval
-- chunks; admins never manage chunks.
--
-- Additive and non-destructive:
-- - guidelines (the old per-section records), document_chunks and documents are not
--   changed or deleted.
-- - search_knowledge returns Published note chunks, plus the old Published sections of
--   any source that does not have a Published note yet. Answers therefore keep using
--   the existing sections until an admin reviews and publishes the new note.
-- - Each source with sections gets a Draft note assembled from them (not retrievable).

create type public.knowledge_note_origin as enum ('manual', 'imported', 'ai_generated', 'ai_organized');

create table public.knowledge_notes (
  id                  uuid primary key default gen_random_uuid(),
  -- One note per source. Null: a manual note with no source file.
  source_document_id  uuid unique references public.documents (id) on delete cascade,
  title               text not null check (char_length(title) between 2 and 200),
  -- The admin's working copy. Never retrieved.
  draft_content       text not null default '' check (char_length(draft_content) <= 400000),
  draft_origin        public.knowledge_note_origin not null default 'manual',
  draft_updated_at    timestamptz not null default now(),
  -- The approved copy the current chunks were built from (null until first publish).
  published_content   text,
  published_at        timestamptz,
  published_by        uuid references public.profiles (id) on delete set null,
  -- draft: not used in answers · published: its chunks are used · archived: hidden
  status              public.publish_status not null default 'draft',
  visibility          public.content_visibility not null default 'authenticated',
  -- Latest Analyze with AI result, waiting for the admin to accept or discard it.
  ai_proposal         text,
  ai_proposal_at      timestamptz,
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger set_updated_at before update on public.knowledge_notes
  for each row execute function private.set_updated_at();

-- Hidden retrieval chunks of Published notes. They exist only while the note is
-- Published; note title, source and visibility are copied in at publish time.
create table public.knowledge_chunks (
  id                  uuid primary key default gen_random_uuid(),
  note_id             uuid not null references public.knowledge_notes (id) on delete cascade,
  chunk_index         integer not null check (chunk_index >= 0),
  heading             text,
  content             text not null check (char_length(content) > 0),
  pages               integer[] not null default '{}',
  note_title          text not null,
  source_document_id  uuid references public.documents (id) on delete cascade,
  visibility          public.content_visibility not null,
  created_at          timestamptz not null default now(),
  search_vector       tsvector generated always as (
    setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('english', content), 'B')
  ) stored,
  unique (note_id, chunk_index)
);

create index knowledge_chunks_search_vector_idx on public.knowledge_chunks using gin (search_vector);
create index knowledge_chunks_source_document_id_idx on public.knowledge_chunks (source_document_id);
create index knowledge_notes_created_by_idx on public.knowledge_notes (created_by);
create index knowledge_notes_published_by_idx on public.knowledge_notes (published_by);

alter table public.knowledge_notes enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Notes: admins only (students reach knowledge through search_knowledge).
create policy "Admins read knowledge notes" on public.knowledge_notes
  for select to authenticated using ((select private.is_admin()));
create policy "Admins insert knowledge notes" on public.knowledge_notes
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update knowledge notes" on public.knowledge_notes
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete knowledge notes" on public.knowledge_notes
  for delete to authenticated using ((select private.is_admin()) and status <> 'published');

-- Chunks: readable like Published guidelines; written only by the functions below.
create policy "Public reads public knowledge chunks" on public.knowledge_chunks
  for select to anon using (visibility = 'public');
create policy "Signed-in users read knowledge chunks" on public.knowledge_chunks
  for select to authenticated using (true);
create policy "Admins write knowledge chunks" on public.knowledge_chunks
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins delete knowledge chunks" on public.knowledge_chunks
  for delete to authenticated using ((select private.is_admin()));

grant select, insert, update, delete on public.knowledge_notes to authenticated;
grant select on public.knowledge_chunks to anon, authenticated;
grant insert, delete on public.knowledge_chunks to authenticated;
grant all on public.knowledge_notes, public.knowledge_chunks to service_role;

-- Publish: the approved draft becomes the live version and its chunks replace the old
-- ones in one transaction. If anything fails, the previous chunks stay active.
-- p_expected_draft_at guards against publishing a draft that changed after it was chunked.
create function public.publish_knowledge_note(p_note_id uuid, p_expected_draft_at timestamptz, p_chunks jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  note public.knowledge_notes;
  source_status public.document_status;
  source_visibility public.content_visibility;
begin
  if not (select private.is_admin()) then
    raise exception 'Only admins can publish knowledge notes.' using errcode = '42501';
  end if;
  select * into note from public.knowledge_notes where id = p_note_id for update;
  if not found then raise exception 'Knowledge note not found.' using errcode = 'P0002'; end if;
  if note.status = 'archived' then raise exception 'Restore this note before publishing it.' using errcode = 'P0001'; end if;
  if note.draft_updated_at <> p_expected_draft_at then
    raise exception 'The draft changed while publishing.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'A note needs content before it can be published.' using errcode = 'P0001';
  end if;
  if note.source_document_id is not null then
    select d.status, d.visibility into source_status, source_visibility from public.documents d where d.id = note.source_document_id;
    if source_status = 'archived' then raise exception 'Restore the source before publishing its note.' using errcode = 'P0001'; end if;
  end if;

  delete from public.knowledge_chunks where note_id = p_note_id;
  insert into public.knowledge_chunks (note_id, chunk_index, heading, content, pages, note_title, source_document_id, visibility)
  select p_note_id, c.chunk_index, nullif(trim(c.heading), ''), c.content, coalesce(c.pages, '{}'),
         note.title, note.source_document_id, coalesce(source_visibility, note.visibility)
  from jsonb_to_recordset(p_chunks) as c(chunk_index integer, heading text, content text, pages integer[]);

  update public.knowledge_notes
     set published_content = draft_content, published_at = now(), published_by = auth.uid(),
         status = 'published', visibility = coalesce(source_visibility, visibility)
   where id = p_note_id;
end;
$$;

-- Move to Draft or Archive: the note leaves answers immediately (its chunks are removed);
-- the draft and the last published text are kept. Restore = Draft.
create function public.set_knowledge_note_status(p_note_id uuid, p_status public.publish_status)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Only admins can change knowledge notes.' using errcode = '42501';
  end if;
  if p_status = 'published' then
    raise exception 'Use publish_knowledge_note to publish.' using errcode = 'P0001';
  end if;
  update public.knowledge_notes set status = p_status where id = p_note_id;
  if not found then raise exception 'Knowledge note not found.' using errcode = 'P0002'; end if;
  delete from public.knowledge_chunks where note_id = p_note_id;
end;
$$;

revoke all on function public.publish_knowledge_note(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.set_knowledge_note_status(uuid, public.publish_status) from public, anon;
grant execute on function public.publish_knowledge_note(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.set_knowledge_note_status(uuid, public.publish_status) to authenticated;

-- Citation title of a note's source (null when the source is archived). Security
-- definer: students cannot read documents while they are being re-analyzed.
create function private.note_source_title(source_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.title from public.documents d where d.id = source_id and d.status <> 'archived';
$$;

-- True when a source's knowledge now comes from its Published note (its old
-- sections are then left out of search).
create function private.source_has_published_note(source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.knowledge_notes n where n.source_document_id = source_id and n.status = 'published');
$$;

revoke all on function private.note_source_title(uuid) from public;
revoke all on function private.source_has_published_note(uuid) from public;
grant execute on function private.note_source_title(uuid) to anon, authenticated;
grant execute on function private.source_has_published_note(uuid) to anon, authenticated;

-- Same signature and columns as before, so lib/rag/search.ts and citations are unchanged.
-- Note chunks: section_id = chunk id; title = heading (source-backed) or note title
-- (manual note); source_reference carries the chunk's pages.
create or replace function public.search_knowledge(query_text text, match_count integer default 5)
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
set search_path = ''
as $$
  with q as (
    select to_tsquery(
      'english',
      array_to_string(tsvector_to_array(to_tsvector('english', coalesce(query_text, ''))), ' | ')
    ) as query
  ),
  note_hits as (
    select c.id,
           case when c.source_document_id is null then c.note_title else coalesce(c.heading, c.note_title) end,
           c.source_document_id,
           s.title,
           json_build_object('version', 1, 'topic', coalesce(c.heading, c.note_title), 'chunkIds', json_build_array(), 'pages', to_json(c.pages))::text,
           case when c.heading is not null then c.heading || E'\n\n' || c.content else c.content end,
           ts_rank_cd(c.search_vector, q.query)
    from public.knowledge_chunks c
    cross join q
    left join lateral (select private.note_source_title(c.source_document_id) as title) s on true
    where numnode(q.query) > 0
      and c.search_vector @@ q.query
      and (c.source_document_id is null or s.title is not null)
  ),
  section_hits as (
    select g.id, g.title, g.source_document_id, s.title, g.source_reference,
           coalesce(nullif(g.content, ''), g.description, ''),
           ts_rank_cd(g.search_vector, q.query)
    from public.guidelines g
    cross join q
    left join lateral (select private.knowledge_source_title(g.source_document_id) as title) s on true
    where g.status = 'published'
      and numnode(q.query) > 0
      and g.search_vector @@ q.query
      and (g.source_document_id is null or s.title is not null)
      and (g.source_document_id is null or not private.source_has_published_note(g.source_document_id))
  )
  select * from (select * from note_hits union all select * from section_hits) hits
  order by 7 desc, 2
  limit least(greatest(match_count, 1), 20);
$$;

grant execute on function public.search_knowledge(text, integer) to anon, authenticated;

-- Compatibility: one Draft note per source that has sections, assembled from them in
-- page order ("## Title", the section text, its pages). Drafts are not retrievable, so
-- answers keep using the existing Published sections until the note is published.
insert into public.knowledge_notes (source_document_id, title, draft_content, draft_origin, visibility, created_by)
select d.id, d.title,
       string_agg(
         '## ' || g.title || E'\n\n' || coalesce(nullif(trim(g.content), ''), g.description, '') ||
         case when jsonb_array_length(coalesce(g.source_reference::jsonb -> 'pages', '[]'::jsonb)) > 0
              then E'\n\n(' || case when jsonb_array_length(g.source_reference::jsonb -> 'pages') = 1 then 'p. ' else 'pp. ' end ||
                   (select string_agg(p, ', ' order by p::int) from jsonb_array_elements_text(g.source_reference::jsonb -> 'pages') p) || ')'
              else '' end,
         E'\n\n'
         order by coalesce((g.source_reference::jsonb -> 'pages' ->> 0)::int, 2147483647), g.title
       ),
       'imported', d.visibility, null
from public.documents d
join public.guidelines g on g.source_document_id = d.id and g.status <> 'archived'
where d.mime_type = 'application/pdf' and g.source_reference like '{%'
group by d.id, d.title, d.visibility;
