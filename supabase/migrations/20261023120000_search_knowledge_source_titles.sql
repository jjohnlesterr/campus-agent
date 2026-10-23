-- Knowledge search also matches the title of a section's source (and its reference label),
-- so "adobong manok" finds the "Ingredients" and "Steps" sections of a text source titled
-- "Adobong Manok Recipe" even when their own text never repeats the title.
--
-- Unchanged: signature and result columns (the app and generated types need no change),
-- security invoker (RLS on guidelines still limits public visitors to Published + public
-- sections), search_path, grants, and every restriction on what can be returned:
--   * only Published sections;
--   * sections of an archived source are never returned — private.knowledge_source_title()
--     returns null for them, which also means their title adds no search terms;
--   * manual entries (no source) are searched exactly as before.
--
-- The source title is weighted B, like section text and below the section title (A): it
-- breaks ties toward the right source without letting generic title words ("Handbook",
-- "Section") outrank a section whose own text answers the question.
--
-- Rollback: supabase/rollbacks/20261023120000_search_knowledge_source_titles.down.sql
-- restores the previous definition (20261007180758_restore_section_search.sql).
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
         ts_rank_cd(g.search_vector || s.terms, q.query) as rank
  from public.guidelines g
  cross join q
  left join lateral (select private.knowledge_source_title(g.source_document_id) as title) s0 on true
  cross join lateral (
    select s0.title, setweight(to_tsvector('english', coalesce(s0.title, '')), 'B') as terms
  ) s
  where g.status = 'published'
    and numnode(q.query) > 0
    and (g.source_document_id is null or s.title is not null)
    and (g.search_vector || s.terms) @@ q.query
  order by rank desc, g.title
  limit least(greatest(match_count, 1), 20);
$$;

grant execute on function public.search_knowledge(text, integer) to anon, authenticated;
