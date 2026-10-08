-- Knowledge Library collections: one organizational level above sources.
-- Knowledge Library → Collection → source (PDF/image or manual entry) → sections.
--
-- Additive and non-destructive:
-- - documents (uploaded sources) and guidelines (manual entries only) gain a nullable
--   collection_id. Null = "Uncategorized" in the admin UI. No IDs change.
-- - Collections cannot be nested (no parent column) and cannot be deleted while any
--   source still points at them (on delete restrict): knowledge is never cascaded away.
-- - Retrieval is unchanged: search_knowledge does not read collections, so Campus Agent
--   keeps searching all Published knowledge across every collection.

create table public.knowledge_collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 100),
  description text check (char_length(description) <= 500),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index knowledge_collections_name_key on public.knowledge_collections (lower(name));
create index knowledge_collections_created_by_idx on public.knowledge_collections (created_by);

create trigger set_updated_at before update on public.knowledge_collections
  for each row execute function private.set_updated_at();

alter table public.documents
  add column collection_id uuid references public.knowledge_collections (id) on delete restrict;

-- Only manual entries carry a collection; a source's sections belong to their source.
alter table public.guidelines
  add column collection_id uuid references public.knowledge_collections (id) on delete restrict,
  add constraint guidelines_collection_manual_only check (collection_id is null or source_document_id is null);

create index documents_collection_id_idx on public.documents (collection_id);
create index guidelines_collection_id_idx on public.guidelines (collection_id);

-- Admins only. Students never see collections; they reach knowledge through search_knowledge.
alter table public.knowledge_collections enable row level security;

create policy "Admins read knowledge collections" on public.knowledge_collections
  for select to authenticated using ((select private.is_admin()));
create policy "Admins insert knowledge collections" on public.knowledge_collections
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update knowledge collections" on public.knowledge_collections
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete knowledge collections" on public.knowledge_collections
  for delete to authenticated using ((select private.is_admin()));

grant select, insert, update, delete on public.knowledge_collections to authenticated;
grant all on public.knowledge_collections to service_role;

-- Existing data: a default "Student Handbook" collection receives the existing handbook
-- sources (e.g. Information WUP). Other ungrouped sources and manual entries stay
-- Uncategorized until an admin moves them.
insert into public.knowledge_collections (name, description, created_by)
select 'Student Handbook', 'Official handbook and academic policies.', null
where exists (select 1 from public.documents where document_type = 'handbook' and collection_id is null);

update public.documents d
   set collection_id = c.id
  from public.knowledge_collections c
 where lower(c.name) = 'student handbook'
   and d.document_type = 'handbook'
   and d.collection_id is null;
