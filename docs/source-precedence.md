# Designated source updates

`lib/knowledge/source-precedence.ts` records explicit university decisions by immutable
Knowledge Library document ID. It currently designates the CECT Agent FAQ source
`4628df71-c802-46bf-8747-77e8a81a5d7b`. Titles, filenames, upload dates and card order
do not confer authority. A renamed source keeps its designation; a replacement source
with a new ID needs a reviewed registry change. Another environment must use its own
source ID. No database schema or metadata migration is required.

The assistant reads visible, non-archived designated sources and their Published
sections with the request's existing client and RLS. It reads all their sections,
independent of the normal full-text top-five cutoff, so a wordier older handbook
cannot push an update out of context. Normal search fetches up to 20 candidates;
after a rejected update is removed, the fallback uses the top five remaining hits.
Source titles and page/section citations come
from those records, not the registry.

Before a directory or older knowledge answer returns, the model checks whether the
update directly addresses the requested information. Shared keywords or a general
subject do not count. A covered question is answered with update passages only:
outdated fees and procedures never enter that generation request. A partial answer
keeps the supported details and identifies the specific omission; an older amount
is not used to guess a fee the update omits. An unrelated update returns no coverage
and the existing directory, map, announcement and knowledge fallback order continues.
Program listings and explicit announcement queries retain their existing routing.

This adds one model coverage/answer call for questions that reach the designated
update check. Covered questions use that answer; uncovered questions may also need
the existing knowledge-generation call. Update lookup or generation failures surface
as errors rather than silently serving superseded guidance. No privileged client,
publication rule, document content or database policy is changed.

Both answer surfaces and stored Markdown show omissions as plain, specific text in
the answer's language. Complete answers omit gap notes. Genuinely unsupported
questions keep the existing no-source fallback and do not cite unrelated passages.

Regression checks: `node --test tests/assistant-knowledge.test.mjs
tests/source-precedence.test.mjs tests/handbook-citations.test.mjs
tests/answer-view.test.mjs` (one command, on a single line).
