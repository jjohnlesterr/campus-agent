-- The campus map image belongs to the Campus Map module, not the Knowledge Library.
-- It is referenced from the existing one-row system_settings table; the file stays in
-- the private `documents` bucket (under campus-map/), but no documents row is created.

alter table public.system_settings
  add column campus_map_path       text,
  add column campus_map_mime_type  text check (campus_map_mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  add column campus_map_updated_at timestamptz,
  add column campus_map_updated_by uuid references public.profiles (id) on delete set null;

comment on column public.system_settings.campus_map_path is 'Storage path (documents bucket) of the current campus map image. Buildings, locations and the legend are separate records.';

-- Anyone may read exactly the current campus map file (it is shown on the Campus Map page).
create function private.is_campus_map_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.system_settings s where s.campus_map_path = object_name);
$$;
revoke all on function private.is_campus_map_file(text) from public;
grant execute on function private.is_campus_map_file(text) to anon, authenticated;

create policy "Anyone can read the campus map image" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'documents' and private.is_campus_map_file(name));

-- Map access no longer depends on a Knowledge Library document (none exist).
drop policy if exists "Signed-in users read campus map files" on storage.objects;
