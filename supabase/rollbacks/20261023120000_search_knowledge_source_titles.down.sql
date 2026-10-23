-- Rollback for 20261023120000_search_knowledge_source_titles.sql: restores search_knowledge
-- exactly as defined in 20261007180758_restore_section_search.sql (sections only, no source
-- titles). Same signature, security invoker and grants; no data is touched. Not a migration:
-- run it manually (SQL editor) only if the source-title search has to be undone.
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
