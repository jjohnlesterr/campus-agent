-- Knowledge Library: an optional admin-written description for each source, shown on
-- source cards and the source page so admins know what a source contains.
--
-- Administrative metadata only: search_knowledge reads Published sections (guidelines),
-- never documents.description, so it is not used to answer students.
-- Additive: existing sources get no description.

alter table public.documents
  add column description text check (char_length(description) between 1 and 1000);
