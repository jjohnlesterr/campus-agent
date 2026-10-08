-- Knowledge Library: admin-controlled order of a source's knowledge sections.
--
-- source_order stays the topic's position in the source document (set by Analyze with
-- AI). sort_order is the order admins see and set by drag and drop; new manual sections
-- go to the end, and re-analysis places new drafts by the document's structure.
--
-- Additive: no content, status, reference or source changes. Existing sections keep
-- the order they are shown in today (source_order, then first cited page, then age).

alter table public.guidelines add column sort_order integer check (sort_order > 0);

-- The backfill is not an edit: keep every section's updated_at as it is.
alter table public.guidelines disable trigger set_updated_at;

with ordered as (
  select g.id,
         row_number() over (
           partition by g.source_document_id
           order by g.source_order nulls last,
                    case when pg_input_is_valid(g.source_reference, 'jsonb')
                         then (g.source_reference::jsonb #>> '{pages,0}')::integer end nulls last,
                    g.created_at
         ) as position
  from public.guidelines g
  where g.source_document_id is not null
)
update public.guidelines g
   set sort_order = ordered.position
  from ordered
 where g.id = ordered.id;

alter table public.guidelines enable trigger set_updated_at;

create index guidelines_source_document_sort_idx on public.guidelines (source_document_id, sort_order);
