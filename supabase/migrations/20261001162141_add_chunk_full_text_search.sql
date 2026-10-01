-- MVP handbook retrieval without embeddings: PostgreSQL full-text search.
-- Section titles are weighted above body text. pgvector stays for later use.
alter table public.document_chunks
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(section_title, '')), 'A') ||
    setweight(to_tsvector('english', content), 'B')
  ) stored;

create index document_chunks_search_vector_idx on public.document_chunks using gin (search_vector);

-- Matches chunks containing ANY meaningful word of the question (stemmed,
-- stop words removed), ranked by ts_rank_cd. security invoker: RLS applies, so
-- anonymous callers only see public documents. Only `ready` documents are searched.
create function public.search_document_chunks(query_text text, match_count integer default 5)
returns table (
  chunk_id       uuid,
  document_id    uuid,
  document_title text,
  document_type  public.document_type,
  page_number    integer,
  section_title  text,
  content        text,
  rank           real
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
  select c.id, d.id, d.title, d.document_type, c.page_number, c.section_title, c.content,
         ts_rank_cd(c.search_vector, q.query) as rank
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join q
  where d.status = 'ready'
    and numnode(q.query) > 0
    and c.search_vector @@ q.query
  order by rank desc, c.chunk_index
  limit least(greatest(match_count, 1), 20);
$$;

grant execute on function public.search_document_chunks(text, integer) to anon, authenticated;
