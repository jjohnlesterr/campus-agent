-- Knowledge sections keep the order in which their topic appears in the source PDF
-- (1 = first topic). Analysis sets it; the source details page sorts by it. Null for
-- admin-added sections and manual entries (shown after the ordered sections).
alter table public.guidelines add column source_order integer check (source_order > 0);

create index guidelines_source_document_order_idx on public.guidelines (source_document_id, source_order);

-- Backfill: match each section's stored topic key to the current extraction's headings
-- (same normalization as topicKey in lib/knowledge/topics.ts) and number topics by
-- their first chunk.
with topics as (
  select c.document_id,
         trim(regexp_replace(lower(replace(replace(regexp_replace(c.section_title, '^\s*(\d{1,3}(\.\d+)*[.)]?|[IVXLCDM]+[.)])\s+', '', 'i'), '’', ''), '''', '')), '[^[:alnum:]]+', ' ', 'g')) as key,
         min(c.chunk_index) as first_chunk
  from public.document_chunks c
  where c.section_title is not null
  group by 1, 2
), ranked as (
  select document_id, key, row_number() over (partition by document_id order by first_chunk) as source_order
  from topics
)
update public.guidelines g
   set source_order = r.source_order
  from ranked r
 where r.document_id = g.source_document_id
   and g.source_reference like '{%'
   and r.key = g.source_reference::jsonb ->> 'topic';
