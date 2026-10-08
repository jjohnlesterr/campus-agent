-- Knowledge Library: admin-controlled order of the source cards in a collection.
--
-- documents.sort_order is the card position within the source's collection (drag and
-- drop). New and moved-in sources go to the end. Existing sources keep today's order:
-- most recent activity first (the newest change to the source or any of its sections).
--
-- Reordering is not an edit: on documents and guidelines, updated_at no longer changes
-- when only sort_order changes, so "Updated" dates and stale-edit checks stay meaningful.
-- Additive: no titles, files, statuses, sections or citations change.

alter table public.documents add column sort_order integer check (sort_order > 0);

create or replace function private.set_updated_at_unless_reorder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'sort_order' - 'updated_at') is distinct from (to_jsonb(old) - 'sort_order' - 'updated_at') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger set_updated_at on public.documents;
create trigger set_updated_at before update on public.documents
  for each row execute function private.set_updated_at_unless_reorder();

drop trigger set_updated_at on public.guidelines;
create trigger set_updated_at before update on public.guidelines
  for each row execute function private.set_updated_at_unless_reorder();

with activity as (
  select d.id, d.collection_id,
         greatest(d.updated_at, coalesce(max(g.updated_at), d.updated_at)) as last_change
  from public.documents d
  left join public.guidelines g on g.source_document_id = d.id
  group by d.id
),
ordered as (
  select id, row_number() over (partition by collection_id order by last_change desc, id) as position
  from activity
)
update public.documents d
   set sort_order = ordered.position
  from ordered
 where d.id = ordered.id;

create index documents_collection_sort_idx on public.documents (collection_id, sort_order);
