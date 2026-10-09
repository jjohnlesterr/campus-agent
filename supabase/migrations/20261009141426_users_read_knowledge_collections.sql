-- School Guides (/app/guides): signed-in users browse Published knowledge grouped by its
-- Knowledge Library collection, so they need to read collection names and descriptions.
-- Read-only; writes stay admin-only. Sections and sources keep their own policies
-- (Published sections and Ready sources only).
create policy "Signed-in users read knowledge collections" on public.knowledge_collections
  for select to authenticated using (true);
