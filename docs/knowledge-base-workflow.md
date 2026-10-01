# Sources to Knowledge Base

Open a Ready PDF source with stored extracted sections and choose **Create Knowledge Base guides**. Generation reads `document_chunks` only. It does not download or parse the PDF, run ingestion, call Claude, or create embeddings.

Sections with the same normalized title are grouped across pages. Numbering, capitalization, and punctuation differences do not create separate topics. Each draft records the source document, topic key, original chunk IDs, and page numbers in the existing `source_reference` text column. No schema migration is needed.

Descriptions are source excerpts. Explicit numbered instructions can populate steps, and an explicit Requirements heading can populate requirements. Unordered policy bullets are not converted into a procedure. A responsible office is assigned only when exactly one existing office is explicitly named. Missing procedures and requirements remain unspecified for admin review.

Generation always creates Draft guides. Repeating it skips existing source/topic guides, including guides whose titles were manually changed. Stable slugs use the existing unique constraint to prevent duplicates during concurrent generation. There is no automatic regeneration or overwrite of edited content.

The Knowledge Base has All, Published, and Draft filters, source filtering, and Newest first, Oldest first, and A–Z sorting. Sorting applies immediately. Each card opens Review / Edit; its independent checkbox selects the guide without opening it. Select all selects the current filtered results. Changing the filter, source, or sort clears the selection.

The bulk toolbar appears when guides are selected. Publish selected affects only selected Draft guides; Unpublish selected affects only selected Published guides. Mixed selections show both actions with eligible counts. Archived guides are excluded, and the server checks the current status to skip stale selections safely. Bulk publishing changes only status, preserves all content and references, and refreshes admin/student views. Successful actions clear selection and report the affected count; failures preserve selection for retry.

Open Review / Edit for manual review and editing of the title, description, requirements, ordered steps, source pages, and supported responsible office beside the original excerpts. Publishing from the editor requires explicit review confirmation. Save draft and Unpublish keep a guide hidden from student queries.

Saving stages the guide as Draft before saving steps; the final publish happens only after all writes succeed. A failed save leaves a recoverable Draft. This is not a multi-table transaction. Stale revision checks prevent an editor from saving over a newer version. Reload the saved guide after a partial failure to verify its persisted steps before publishing.

Student guide list and detail queries explicitly select only Published records; existing row-level security remains in place. The student shell and styling are unchanged.

## Verification

```powershell
npx.cmd next typegen
npx.cmd tsc --noEmit
node --test tests/knowledge-guides.test.mjs tests/source-upload.test.mjs
```

The optional `CAMPUS_KB_SNAPSHOT` environment variable points to a local JSON fixture shaped as `{ source, chunks }`. It enables verification against a read-only snapshot of a current source. Database writes in these tests use an in-memory mock.

The current Information-WUP.pdf snapshot contained 24 chunks and produced 18 draft topics in verification. Graduation Honors merged pages 1–2, Shifting / Transfer merged pages 2–3, Academic Rules merged pages 4–5, and Colleges and Academic Programs merged pages 7–8. Shifting / Transfer retained four explicitly numbered steps. The remaining topics include enrollment, INC, graduation clearance, leave of absence, scholarships, document requests, dress code, violations, academic terms, and calendar sections.

Browser verification used temporary fixture routes and mocked generation responses. It covered status filters, A–Z sorting, desktop/mobile layouts, linked excerpts, step editing, the review gate, and repeated-generation feedback. Temporary routes were removed afterward. No live guides were created or published during verification; a dedicated admin test session was unavailable.

Bulk publishing verification also used the actual library component in a temporary fixture route with mocked action responses. It checked filtered Select all, Clear selection, pointer/keyboard checkbox isolation, whole-card navigation, mixed-status action payloads, disabled controls during updates, selection retention after errors, selection clearing after success, immediate sorting with source/filter preservation, and desktop/mobile layouts. Regression tests exercise the real server action against the in-memory database, including status-only writes, source/content/reference preservation, stale selections, authentication, validation, and database failures.
