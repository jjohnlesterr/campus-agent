-- Student location answers: campus locations carry the official map's building
-- number, plus aliases students commonly use. Locations with a building number
-- come from the official campus map legend; the assistant only answers from those.

alter table public.campus_locations
  add column building_number smallint check (building_number between 1 and 999),
  add column aliases text[] not null default '{}';

-- One row per place per numbered building, so re-running the legend import never duplicates.
create unique index campus_locations_map_entry_key
  on public.campus_locations (building_number, name)
  where building_number is not null;

-- Students can open the official campus map: signed-in users may read the file of a
-- Ready Campus Map source — nothing else in the private documents bucket.
-- The documents subquery runs under the caller's RLS (signed-in users read Ready sources).
create policy "Signed-in users read campus map files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = storage.objects.name
        and d.document_type = 'campus_map'
        and d.status = 'ready'
    )
  );
