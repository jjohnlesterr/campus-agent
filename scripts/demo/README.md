# CECT Agent — INC walkthrough demo video

An 18-second, 1920×1080 product video of a student asking CECT Agent
"Paano mag-ayos ng INC?" and getting a source-based answer.

- Page: `components/demo/inc-walkthrough.tsx`, served at `/demo/inc-walkthrough`
  **only under `next dev`** (a 404 in production builds). Not linked from any navigation.
- It reuses the real `StudentShell`, `QuestionComposer`, `AnswerView` and `LogoMark`.
  Everything runs offline: no Anthropic or Supabase calls, no account, nothing stored.
- The answer, requirements and source line are copied word for word from a real
  production answer (2026-10-23). Do not edit them into new content.

## Watch it live

1. `npm run dev`
2. Open `http://localhost:3000/demo/inc-walkthrough` in a 1920×1080 window.
   It plays once; press **R** to replay.

While it plays, the address bar switches to `/app` and `/app/chat/demo-inc-walkthrough`
(like the real chat does after the first answer). Reloading at that point opens the real
app; open the demo URL again to start over.

To record it with OBS or a screen recorder instead of the script: use a 1920×1080 browser
window in full screen (F11), hide the bookmarks bar, open the URL, press R, and record 18 s.

## Export the MP4

With `npm run dev` running:

```sh
node scripts/demo/record-inc-walkthrough.mjs            # --url http://localhost:3000 --fps 30 --scale 1.25
```

The script starts the installed Chrome headless, seeks the demo clock to each frame
(`?record=1`, `window.__demoSeek(t)`), screenshots it, encodes H.264 with Chrome's
WebCodecs and writes the MP4 container itself. No packages are installed. If
Playwright's ffmpeg is present (`%LOCALAPPDATA%/ms-playwright/ffmpeg-*`), a VP8 WebM is
written too.

Output in `scripts/demo/output/` (git-ignored):

| File | |
| --- | --- |
| `cect-agent-inc-demo.mp4` | H.264, 1920×1080, 30 fps, 18 s, no audio |
| `cect-agent-inc-demo.webm` | VP8 copy (when ffmpeg is available) |
| `frames/` | 540 lossless PNG frames, for video editors |
| `verify/` | stills decoded back from the MP4 |

## Timeline and narration cues

Narration (English, added afterwards in an editor):

> "Students can ask questions in their own words. CECT Agent searches reliable university
> sources and provides clear guidance, including requirements and source references."

| Time | On screen | Narration cue |
| --- | --- | --- |
| 0.0–1.4 s | New conversation screen; cursor moves to the question box | 0.5 s — "Students can ask questions in their own words." |
| 1.4–4.5 s | Click, "Paano mag-ayos ng INC?" is typed | (continues) |
| 4.5–5.55 s | Cursor moves to Send and clicks | — |
| 5.55–8.75 s | Question appears in the conversation; "CECT Agent is checking university sources…" | 5.6 s — "CECT Agent searches reliable university sources" |
| 8.75–13.7 s | Answer, Requirements, Good to know and the source line appear in turn | 9.0 s — "and provides clear guidance, including requirements and source references." |
| 13.7–18.0 s | Full answer held | — |

---

# CECT Agent — Admin source management demo video

A 34-second, 1920×1080, 30 fps video of an administrator adding a PDF to the Knowledge
Library, analyzing it, reviewing the Draft sections and publishing them. It follows the
real workflow and wording:

Dashboard → **Knowledge Library** → **Student Handbook** collection → **Add source** →
**Upload PDF** (Title, Description, File) → **Upload** → source page (**Uploaded**,
"Not analyzed yet") → **Analyze with AI** → **Start analysis** → "Analyzed 12 pages:
14 new Draft sections." → review the **Knowledge Sections** → **Publish drafts (14)** →
**I’ve reviewed them — publish** → every section **Published**, source "Ready for CECT
Agent answers".

- Page: `components/demo/admin-source-walkthrough.tsx`, served at `/demo/admin-sources`
  **only under `next dev`** (a 404 in production builds). Not linked from any navigation.
- Reuses the real `AdminShell` and sidebar, `CollectionCard`, `CollectionMenu`,
  `CreateCollectionButton`, `SourceActions`, `SourceSections`, `StatusBadge`, `EmptyState`,
  `PageHeader`, `Field`, `Button` and `Input`. Server pages (Dashboard, collection, source
  details) and dialogs whose open state lives inside real components (Add source, Upload
  PDF, Analyze with AI, Publish drafts) are copied markup, driven by the demo clock.
- Offline: no upload, no Supabase or Anthropic call, no records created or published.
- The file is the local `Information-WUP.pdf` (12 pages, 290 KB), the same source the
  app's tests use. Section text comes from `components/demo/admin-source-data.ts`,
  generated from that PDF with the app's own extraction and section slicing:

  ```sh
  node scripts/demo/build-admin-source-data.mjs "C:/Users/<you>/Desktop/Tan Projects/Information-WUP.pdf"
  ```

  Only the AI heading outline is replaced by the PDF's own numbered headings.
- Illustrative, not from the app: the dashboard counts and recent updates, the admin
  name, the collection list, and the AI overview paragraph (written from the PDF's
  headings). The Original PDF panel shows page 1's extracted text instead of the
  embedded PDF viewer.

## Watch it live

`npm run dev`, then open `http://localhost:3000/demo/admin-sources` in a 1920×1080 window.
It plays once; press **R** to replay. The address bar follows the real routes
(`/admin`, `/admin/knowledge`, …); open the demo URL again to start over.

## Export the MP4

```sh
node scripts/demo/record-inc-walkthrough.mjs --demo admin
node scripts/demo/record-inc-walkthrough.mjs --demo admin --preview 8,20.5,30.5   # stills only
```

Output in `scripts/demo/output/admin/` (git-ignored): `cect-agent-admin-sources-demo.mp4`,
the `.webm` copy, `frames/` (1,020 PNGs) and `verify/` (stills decoded from the MP4).

## Timeline and narration cues

> "Administrators manage the information that powers CECT Agent. By uploading university
> documents, they can analyze the content, review the extracted information, and publish
> reliable knowledge sources for students."

| Time | On screen | Narration cue |
| --- | --- | --- |
| 0.0–1.9 s | Admin Dashboard; cursor clicks Knowledge Library | 0.5 s — "Administrators manage the information that powers CECT Agent." |
| 1.9–6.2 s | Collections → Student Handbook → Add source → Upload PDF | — |
| 6.2–14.3 s | PDF dragged in, title typed, Upload | 6.8 s — "By uploading university documents," |
| 14.3–19.6 s | Source page; Analyze with AI → Start analysis → Analyzing… | 15.8 s — "they can analyze the content," |
| 19.6–27.3 s | 14 Draft sections appear; page scrolls through them | 21.5 s — "review the extracted information," |
| 27.3–29.5 s | Publish drafts (14) → I’ve reviewed them — publish | 27.6 s — "and publish reliable knowledge sources for students." |
| 29.5–34.0 s | Sections Published; back to "Ready for CECT Agent answers" | — |
