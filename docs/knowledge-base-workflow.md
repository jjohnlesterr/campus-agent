# Knowledge Library

Admin → **Knowledge Library** (`/admin/knowledge`) replaces the separate Sources and Knowledge Base pages. It is organized as **Knowledge Library → Collection → source → knowledge sections**:

- The root lists **collections** (`knowledge_collections`: name, optional description) with source and section counts. Collections are one level only (no nesting) and are organizational metadata: Campus Agent searches Published knowledge from every collection.
- A collection lists its **sources** (uploaded files, `documents.collection_id`) and **manual entries** (knowledge sections with no file, `guidelines.collection_id`) as cards, with All / Published / Drafts / Archived tabs and search. Upload PDF and Create manually live here.
- Sources with no collection appear under **Uncategorized** (a system grouping, not a row). Any source or entry can be moved with **Move to collection**; only `collection_id` changes.
- A collection can be deleted only when it is empty (also enforced by `on delete restrict`).

- Source = the original file (PDF, or an image such as the campus map).
- Knowledge section = reviewed information, stored in `guidelines`. Sections extracted from a source keep `source_document_id` and their page references; manual entries have no source.
- Only **Published** sections are used by Campus Agent. Draft and Archived sections, and every section of an archived source, are never retrieved.

## Routes

| Route | Purpose |
| --- | --- |
| `/admin/knowledge` | Library root: collection cards, search, Create collection |
| `/admin/knowledge/collections/[id]` | One collection (or `uncategorized`): source cards, tabs, search, Upload PDF, Create manually, Edit/Delete collection |
| `/admin/documents/[id]` | Source details: summary, Original PDF, then Knowledge Sections below it in page order (title, pages, status, text; Edit in place, overflow actions, Add section, Publish drafts with a review confirmation) |
| `/admin/knowledge/[id]` | Review / edit one section (PDF page on the left, section on the right) |
| `/admin/knowledge/new` | Create a manual entry (`?collection=<id>` puts it in that collection) |
| `/admin/documents` | Redirects to the library (`?upload=1` asks the admin to open a collection first) |

## Workflow

1. **Upload PDF.** The file is verified by its bytes and saved as **Uploaded**. Nothing is extracted or published. Images and Campus Map files are Ready reference files.
2. **Analyze with AI** (confirmation dialog). Runs the existing pipeline:
   - text is extracted page by page and chunked (`lib/rag/ingest.ts`, status Processing → Ready/Failed);
   - chunks are grouped into topics (`lib/knowledge/topics.ts`) and each new topic is saved as a **Draft** section whose `content` is the verbatim extracted text, with page references in `source_reference`;
   - one Claude call (`lib/knowledge/analyze.ts`) writes an admin-only document summary and key topics, and suggests a category, a short summary and an office for each **new** Draft. An office is kept only when the section text names it. If Claude is unavailable, the Drafts are still created.
3. **Review.** Each section opens beside the original PDF page. Admins edit title, category, page reference, summary, content, responsible office and optional School Guides requirements/steps. Publishing an AI-extracted section requires the review checkbox.
4. **Publish** makes the section available to Campus Agent and School Guides. **Unpublish** moves it back to Draft; **Archive** hides it; archived sections restore as Draft. Only Draft/Archived sections can be deleted.

Manual entries (title, category, content, optional office and reference note, Draft or Published) work without a file.

Source actions: View PDF, Replace file, Analyze / Re-analyze, Archive (archives the source and all of its sections), Restore (sections stay Archived), Delete (only when no section is Published; its Draft/Archived sections are deleted with it).

## Student retrieval

`lib/rag/search.ts` calls `search_knowledge` (migration `20261006032400_knowledge_library.sql`): PostgreSQL full-text search over Published sections (title weighted above summary + content), under the caller's RLS, so public visitors only see Published + public sections. Citations use the source title and the section's pages (`Information WUP — Pages 1, 2`); manual entries cite their title and reference note. `private.knowledge_source_title` returns the source title for citations even while a source is being re-analyzed, and returns nothing for archived sources.

The migration backfilled `content` for existing sections from their linked extracted text, so current answers keep the same wording and page citations. `search_document_chunks` is unused but kept for rollback.

## Note: retired one-note experiment

Migration `20261007172631_knowledge_notes.sql` briefly added a one-large-note workflow (`knowledge_notes`, `knowledge_chunks`, `publish_knowledge_note`, `set_knowledge_note_status`). It was reverted: `20261007180758_restore_section_search.sql` restored the section-only `search_knowledge` above and revoked the two functions. The tables and one imported Draft note were left in place, unused, rather than dropped. No chunks were ever published.

## Re-analysis safety (MVP)

Re-analysis never modifies or deletes existing sections. Published sections keep answering from their stored content while the source is re-extracted, even if extraction fails. Only topics that do not exist yet are added as Drafts.

**Known limitation / future improvement:** when an updated PDF changes the text of a topic that already has a section, re-analysis does not create a replacement Draft for it (topics are matched by title, and the existing unique slug allows one section per source topic). Admins update that section's content manually. Proper versioning would need a "replaces section" link and a draft-revision table; it was not added to avoid a risky schema change.

## Verification

```powershell
npx.cmd next typegen
npx.cmd tsc --noEmit
npx.cmd eslint app components lib tests
node --test tests/*.test.mjs
npx.cmd next build
```

The optional `CAMPUS_KB_SNAPSHOT` environment variable points to a local JSON fixture shaped as `{ source, chunks }` for checking topic grouping against a snapshot of a real source. Database writes in tests use an in-memory mock; Claude is mocked.
