-- Admin → Sources: two more source types, and image files for campus maps.
alter type public.document_type add value if not exists 'announcement';
alter type public.document_type add value if not exists 'campus_map';

alter table public.documents drop constraint documents_mime_type_check;
alter table public.documents add constraint documents_mime_type_check
  check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp'));

-- The private documents bucket also accepts map images (still admin-only, 25 MB).
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where id = 'documents';
