-- Reverts the one-note Knowledge Notes experiment in retrieval only: search_knowledge
-- again searches Published knowledge sections (guidelines) and nothing else, exactly as
-- defined in 20261006032400_knowledge_library.sql. Non-destructive: the experimental
-- knowledge_notes / knowledge_chunks tables, their functions and the one imported
-- Draft note are left in place, unused (no chunks were ever published).
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

-- Nothing in the app calls the experiment's publish/status functions any more.
revoke execute on function public.publish_knowledge_note(uuid, timestamptz, jsonb) from authenticated;
revoke execute on function public.set_knowledge_note_status(uuid, public.publish_status) from authenticated;
