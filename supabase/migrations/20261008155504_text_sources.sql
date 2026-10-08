-- Knowledge Library: text sources. An admin can write or paste verified text as a
-- source in a collection, next to uploaded PDFs and images. A text source is a normal
-- documents row whose file is the plain text, saved to the private documents bucket by
-- the app, so it goes through the same pipeline as a PDF: Analyze with AI → Draft
-- sections → admin review → Published.
--
-- Additive and non-destructive: no rows are changed and no columns are removed.

-- 1. Plain-text files are a third source format (origin: written in the app).
alter table public.documents drop constraint documents_mime_type_check;
alter table public.documents add constraint documents_mime_type_check
  check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'));

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain']
where id = 'documents';

-- 2. Optional citation details for any source: where the information comes from
--    (e.g. "Registrar memo, Aug 2026") and a link to the original.
alter table public.documents
  add column reference_label text check (char_length(reference_label) between 1 and 300),
  add column source_url      text check (char_length(source_url) <= 2000 and source_url ~* '^https?://');

-- 3. Citations name the source with its reference label when it has one:
--    "Enrollment clarification — Registrar memo, Aug 2026".
create or replace function private.knowledge_source_title(source_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.title || coalesce(' — ' || d.reference_label, '')
  from public.documents d
  where d.id = source_id
    and d.status <> 'archived'
    and exists (
      select 1 from public.guidelines g
      where g.source_document_id = d.id and g.status = 'published'
    );
$$;
