-- Campus Agent MVP schema, migration 4 of 4: storage buckets.
-- Source: docs/schema-proposal.md (revision 2) §5.10.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents',     'documents',     false, 26214400, array['application/pdf']),                       -- 25 MB, admin-only
  ('public-assets', 'public-assets', true,  5242880,  array['image/png', 'image/jpeg', 'image/webp']);  -- 5 MB, logo + campus map; no SVG

create policy "Admins manage official documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and (select private.is_admin()))
  with check (bucket_id = 'documents' and (select private.is_admin()));

-- Files in public-assets are served by public URL; only admins upload, replace or delete them.
create policy "Admins manage public assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and (select private.is_admin()))
  with check (bucket_id = 'public-assets' and (select private.is_admin()));
