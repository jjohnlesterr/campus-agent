-- Handbook chunks are stored as soon as text is extracted; embeddings are filled in
-- later once an embeddings provider is configured. Chunks without an embedding are
-- never returned by match_document_chunks (their similarity is null).
alter table public.document_chunks alter column embedding drop not null;
