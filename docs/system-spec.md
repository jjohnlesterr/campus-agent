# Campus Agent — System Specification

> **Product change (2026-10-08):** the Events module is retired. University-wide **Announcements** (optional category, published date, optional source label/URL; no department targeting) now carry current notices — enrollment schedules, suspensions, advisories, scholarship reminders and official university activities. Campus Agent answers time-sensitive questions from Published announcements first. Sections below that describe Events or department-specific announcements are historical. The `events` table is kept, unused.

## 1. Purpose

This document defines the expected system behavior, user roles, pages, permissions, data entities, AI flows, document ingestion pipeline, and core application rules for Campus Agent.

This specification should be treated as the technical source of truth together with:

- docs/plan.md
- docs/skills.md

Do not implement features that contradict this specification without reviewing the project scope first.


---

# 2. Product Summary

Campus Agent is an AI-powered university information and process navigator designed primarily for incoming freshmen and campus visitors/prospective students.

It is no longer exclusive to currently enrolled students. Published knowledge useful to current students (e.g. INC, graduation honors) stays available.

Its primary purpose is to help freshmen and visitors:

- understand university procedures
- find official requirements
- identify responsible offices
- locate campus offices
- view office hours
- discover events
- view announcements
- receive structured step-by-step guidance
- see official source references

Campus Agent does NOT process official university transactions.

It must not:

- submit enrollment applications
- submit leave requests
- request TOR on behalf of students
- modify student grades
- process payments
- approve clearance
- modify student academic records


---

# 3. System Experiences

Campus Agent contains three main experiences:

1. Public (guest) experience: landing page with a limited free AI
2. Authenticated user experience: incoming freshmen and visitors
3. Internal admin system


---

# 4. Roles

Only two account roles exist: **user** and **admin**.

Freshman / visitor is a profile field (`profiles.user_type`), not a role: both have the same permissions.

## 4.1 Guest (signed out)

No account required.

Can access:

- landing page
- the landing-page AI: **3 free successful questions** (see §81)
- public, published, verified knowledge only

Cannot access:

- saved conversation history
- profile
- admin system
- authenticated-only or internal information

After 3 successful questions the ask box is replaced by a sign-up gate:

"You’ve used your free questions. Create an account to continue using Campus Agent and save your conversations." with **Create account** and **Sign in**.


---

## 4.2 User (incoming freshman or visitor)

Self-registered account.

Can access:

- Campus Agent AI (no question limit)
- saved conversation history (owner-only; delete supported)
- School Guides / Knowledge
- events and announcements (intended college ranked first, never restricted)
- offices and campus map
- How It Works
- own profile (name, user type, intended college/program)

User cannot:

- create/edit official knowledge
- upload official documents
- create events or announcements
- modify office information
- access admin routes


---

## 4.3 Admin

MVP role:

Super Admin

Admin can:

- manage Knowledge Base
- upload documents
- manage guidelines
- manage events
- manage announcements
- manage offices
- manage campus locations
- view and manage users
- use Admin AI Assistant
- configure basic system settings

There is no public admin registration. Admin accounts are authorized manually in the database.


---

# 5. Authentication

Authentication provider:

Supabase Auth (email + password).

Role is stored in trusted database data: `profiles.role` (enum `app_role`).

Database values:

- `student`: every non-admin account. Kept as the internal value for backward compatibility and shown as **User** in the product.
- `admin`

## 5.1 Public sign-up (`/signup`)

Any valid email address may register.

Required: full name, email, password, confirm password. The full name is the display name used in greetings ("What do you need help with, Maria?").

Not asked at sign-up: user type, intended college, intended program. The `profiles` columns stay nullable; users can set them later on their profile.

Not required: student ID, school email domain, year level, department.

Security:

- the form has no role field, and any role sent to the server is ignored
- the signup trigger (`private.handle_new_user`) always creates the profile with the default user role; any user type, college or program in the metadata (older clients) is validated again before it is stored
- self-registered accounts (`signup_source: "self"` in the metadata) have `must_change_password = false`; admin-provisioned accounts keep `true`
- with Supabase "Confirm email" enabled, the user confirms via `/auth/confirm`; otherwise they land on `/app`

## 5.2 Legacy and admin-created accounts

Accounts created by admins before public sign-up (student ID, department, program, year level, temporary password) keep working. Those columns are nullable and kept.

Admins may still create an account manually from Admin → Users (temporary password, changed on first login). This is a secondary path, not the main onboarding flow.


---

# 6. Login Behavior

There should NOT be:

- Login as Student / Login as Admin buttons
- user-selected role toggle

User signs in normally ("Sign in to continue to Campus Agent.").

After login:

If role = user (`student` in the database): redirect to `/app`

If role = admin: redirect to `/admin`


---

# 7. Admin Access Protection

Admin authorization must not depend only on UI visibility.

Required protection:

- authenticated session
- trusted role check
- protected admin routes
- server-side verification where applicable
- Supabase RLS where applicable

If a student manually visits:

/admin

the system must deny access.


---

# 8. Public Route Structure

Recommended routes:

/

Public landing page


/login, /signup

Authentication


/guides

Optional public school guides


/events

Public events


/offices

Public office directory


/map

Public campus map


---

# 9. Student Route Structure

Recommended:

/app

Student home


/app/chat

AI conversation


/app/chat/[conversationId]

Existing conversation


/app/guides

School Guides


/app/guides/[guideId]

Guide details


/app/offices

Office directory


/app/offices/[officeId]

Office details


/app/events

Events


/app/events/[eventId]

Event details


/app/announcements

Announcements


/app/map

Campus map


/app/profile

Student profile


/app/how-it-works

Campus Agent explanation


---

# 10. Admin Route Structure

Recommended:

/admin

Admin dashboard


/admin/knowledge

Knowledge Base


/admin/knowledge/new

Create guideline


/admin/knowledge/[id]

Guideline details/edit


/admin/documents

Uploaded documents


/admin/documents/[id]

Document details


/admin/events

Event management


/admin/announcements

Announcement management


/admin/offices

Office management


/admin/campus-map

Campus Map (Campus Information): map image, map legend, and the Buildings & Locations directory (campus_buildings, campus_locations, campus_map_legend) that answers location questions. /admin/locations redirects here.


/admin/ai

Admin AI Assistant


/admin/settings

Basic configuration


---

# 11. Public Landing Page

Landing page should include:

- Campus Agent branding
- short product explanation
- public AI input
- popular topics
- enrollment/admission shortcuts
- selected school guides
- upcoming public events
- office directory shortcut
- campus map shortcut
- Sign in and Create account CTAs (no admin login option)

Hero: "New to campus? Ask Campus Agent."

Supporting text: "Get quick answers about admissions, enrollment, programs, campus offices, policies, events, and university services."

Suggested questions: How do I apply for admission? · What programs does CECT offer? · What are the freshman requirements? · Where is the Registrar? · Are there upcoming campus events?

Subtle note: "3 questions free. Sign up to continue and save your chats." The remaining count is shown after each answer ("2 free questions remaining").

Header: How It Works · Guides · Campus Map · Sign in · Create account


---

# 12. Student Home

Student dashboard/home should contain:

## Profile Summary

- name
- program
- department
- year level

## Personalized Announcements

Prioritize:

1. program-specific
2. department-specific
3. university-wide

## Upcoming Events

Prioritize:

1. student program
2. department
3. year level
4. university-wide

## Quick Guides

Examples:

- Enrollment
- INC Grade
- Clearance
- Graduation
- Dean's List

## Ask Campus Agent CTA

Primary entry point to AI.


---

# 13. Student Sidebar

Recommended navigation:

- New Conversation
- School Guides
- Offices
- Events
- Announcements
- Campus Map
- How It Works

Below:

Recent Conversations


---

# 14. User Profile

Primary fields:

- id
- full_name
- email
- role (`student` = user, `admin`)
- user_type (`freshman` | `visitor`; null for admins and legacy accounts)
- intended_department_id (optional)
- intended_program_id (optional)
- created_at
- updated_at

Legacy fields (nullable, kept for backward compatibility; not asked at sign-up):

- student_id
- department_id
- program_id
- year_level
- must_change_password (admin-created accounts only)

Users may edit their own full_name, user_type and intended college/program. Role, email and must_change_password are never user-editable.

Personalization uses intended_department_id, falling back to the legacy department_id.


---

# 15. Department Personalization

Department/program/year level should affect content ranking.

Example:

BSIT 3rd Year student sees:

- BSIT events first
- CCS announcements first
- university-wide content after

However:

students may still browse public events from other departments.

Department is used for personalization, not strict isolation unless content is explicitly restricted.


---

# 16. AI Conversation UI

The student AI interface should consist of:

- conversation history/sidebar
- main chat workspace
- user message
- structured AI answer
- sources/references
- relevant office card
- relevant event/announcement card when applicable
- input composer


---

# 17. AI Answer Modes

Campus Agent should determine the appropriate answer format.


## 17.1 Process Answer

For procedural questions.

Examples:

- How do I fix an INC?
- How do I enroll?
- How do I apply for leave?
- How does clearance work?

Response:

- title
- short explanation
- steps
- requirements
- responsible office
- location
- office hours
- sources


---

## 17.2 Direct Information Answer

For factual questions.

Examples:

- Where is the Registrar?
- Who is the office head?
- What time does Accounting open?
- When is Foundation Week?


---

## 17.3 Combined Answer

Uses multiple data sources.

Example:

"How do I fix my INC and where should I go?"

Sources:

- handbook/RAG
- office record
- campus location
- office hours


---

# 18. AI Response Structure

Preferred internal response shape:

```ts
type CampusAgentResponse = {
  answerType: "process" | "direct" | "combined";
  title: string;
  summary?: string;
  steps?: ProcessStep[];
  requirements?: string[];
  office?: OfficeReference;
  event?: EventReference;
  announcement?: AnnouncementReference;
  sources: SourceReference[];
  warning?: string;
};
```

---

# 19. Process Step Structure

Suggested structure:

```ts
type ProcessStep = {
  order: number;
  title: string;
  description?: string;
  status?: "not_started" | "current" | "completed";
};
```

For the MVP, process status may be visual only.

Campus Agent does not officially track university transactions.

---

# 20. Conversations

Recommended entities:

conversations

messages

Conversation fields:

- id
- user_id
- title
- created_at
- updated_at

Message fields:

- id
- conversation_id
- role
- content
- response_metadata
- created_at

Possible roles:

- user
- assistant
- system

---

# 21. Conversation Titles

Conversation title may be generated from the first question.

Examples:

"How to fix an INC grade"

"Dean's List requirements"

"Registrar office location"

Keep titles concise.

---

# 22. School Guides

School Guides are published, admin-approved procedures.

Users can browse them without AI.

Guide fields may include:

- id
- title
- slug
- description
- category_id
- responsible_office_id
- status
- visibility
- effective_date
- source_summary
- created_at
- updated_at

---

# 23. Guideline Steps

Separate table recommended:

guideline_steps

Fields:

- id
- guideline_id
- step_number
- title
- description
- created_at
- updated_at

---

# 24. Guide Categories

Suggested categories:

- Enrollment
- Admissions
- Academic Records
- INC / Grades
- Scholarships
- Clearance
- Leave of Absence
- Graduation
- Document Requests
- Student Policies

Categories should be database-driven rather than hardcoded where practical.

---

# 25. Guideline Status

Allowed states:

- draft
- published
- archived

Only published guidelines should appear in the student-facing experience.

---

# 26. Guideline Visibility

Possible visibility:

- public
- authenticated
- department
- program

For MVP, start simple:

- public
- authenticated

---

# 27. Offices

Office entity should support:

- id
- name
- short_name
- description
- head_name
- head_title
- office_hours
- campus_location_id
- contact_email
- contact_phone
- visibility
- created_at
- updated_at

---

# 28. Office Data for MVP

Initial office data may contain only:

- office name
- office head
- office hours
- campus location

Additional fields are optional.

---

# 29. Campus Locations

Campus location fields may include:

- id
- name
- building_name
- floor
- description
- map_x
- map_y
- map_label
- image_url
- created_at
- updated_at

---

# 30. Campus Map Strategy

Initial MVP does not require GPS navigation.

Use the official campus map.

Locations can be represented using:

- labeled map coordinates
- relative X/Y positioning
- building references
- static map markers

Example:

Registrar

Building:

Administration Building

Floor:

Ground Floor

Map Position:

x = 42%

y = 31%

---

# 31. Events

Event fields:

- id
- title
- description
- start_date
- end_date
- start_time
- end_time
- venue
- department_id
- program_id
- year_level
- visibility
- source
- status
- created_by
- created_at
- updated_at

---

# 32. Event Visibility

Possible values:

- public
- university
- department
- program
- year_level

---

# 33. Event Status

Possible values:

- draft
- published
- cancelled
- completed

---

# 34. Calendar of Activities

Official Calendar of Activities should be converted into structured events.

Do NOT store the calendar only as a PDF if structured data can be extracted.

Keep the original source document for reference if useful.

---

# 35. Announcements

Announcement fields:

- id
- title
- content
- category
- department_id
- program_id
- year_level
- visibility
- publish_at
- expires_at
- status
- source
- created_by
- created_at
- updated_at

---

# 36. Announcement Status

Allowed:

- draft
- published
- archived

---

# 37. Announcement Categories

Possible:

- General
- Academic
- Registrar
- Enrollment
- Scholarship
- Department
- Campus
- Emergency

---

# 38. Knowledge Base

Knowledge Base is the central admin module for verified university procedures.

Admin should be able to:

- view guidelines
- search guidelines
- filter categories
- create guideline
- edit guideline
- publish guideline
- archive guideline
- connect guideline to source documents
- connect guideline to office

---

# 39. Knowledge Base UI

Recommended desktop layout:

Left Sidebar

→ admin navigation

Secondary Category Panel

→ guideline categories

Main Area

→ search

→ filters

→ Create Guideline

→ Upload Document

→ guideline cards

---

# 40. Guideline Card

Each card may display:

- title
- category
- status
- number of steps
- responsible office
- last updated
- source count

---

# 41. Documents

Documents represent official uploaded university sources.

Examples:

- handbook
- memo
- policy
- guideline
- calendar PDF

Fields may include:

- id
- title
- document_type
- file_path
- file_name
- mime_type
- status
- visibility
- effective_date
- uploaded_by
- created_at
- updated_at

---

# 42. Document Types

Suggested:

- handbook
- memo
- policy
- guideline
- calendar
- form
- other

---

# 43. Document Status

Allowed:

- uploaded
- processing
- ready
- failed
- archived

---

# 44. Document Upload Flow

Admin:

Upload PDF

→ validate file

→ upload to Supabase Storage

→ create document record

→ start text extraction

→ clean extracted text

→ chunk content

→ create embeddings

→ insert document chunks

→ mark document ready

---

# 45. Initial PDF Support

MVP supports:

- PDFs with selectable text

Do not require OCR initially.

If PDF contains only scanned images:

mark as unsupported or requiring OCR.

---

# 46. Document Chunks

Suggested fields:

- id
- document_id
- content
- chunk_index
- page_number
- section_title
- embedding
- metadata
- created_at

---

# 47. Embedding Dimension

Embedding vector dimension must match the selected embedding provider.

Do not hardcode a dimension until the embeddings model is finalized.

The vector schema should be created based on the actual chosen model.

---

# 48. RAG Retrieval Function

Expected behavior:

Input:

- query embedding
- optional filters
- similarity threshold
- result limit

Output:

- matching chunks
- document metadata
- similarity score
- page/section reference

---

# 49. Student RAG Flow

Student question:

↓
normalize input

↓
determine whether document retrieval is needed

↓
generate query embedding

↓
search pgvector

↓
retrieve relevant chunks

↓
retrieve structured data if relevant

↓
build verified context

↓
send context + user question to Claude

↓
Claude produces structured response

↓
display sources

---

# 50. Structured Database Lookup

Structured data lookup should be used for:

- events
- announcements
- offices
- office hours
- office heads
- campus locations
- departments
- programs

---

# 51. Intent Routing

Campus Agent should determine likely data requirements.

Possible intents:

- policy/process
- office
- location
- event
- announcement
- guide
- mixed

Example:

"Where is the Registrar?"

intent:

office/location

Example:

"How do I fix an INC?"

intent:

policy/process

Example:

"How do I fix an INC and where do I go?"

intent:

mixed

---

# 52. Intent Implementation

MVP should avoid an unnecessarily complex agent architecture.

Prefer simple application logic.

Possible approach:

1. Send query to main AI with lightweight routing instructions.
2. Determine required data sources.
3. Retrieve those sources.
4. Generate final answer.

Do not build a large multi-agent system unless later required.

---

# 53. Claude Responsibilities

Claude Sonnet should handle:

- interpreting questions
- identifying intent
- interpreting retrieved policy
- combining multiple verified sources
- explaining procedures
- creating structured responses
- generating admin drafts

---

# 54. Claude Must Not

Claude must not:

- invent university policies
- invent requirements
- invent deadlines
- invent office information
- override database permissions
- publish admin content automatically
- use model knowledge as authoritative university policy

---

# 55. AI Context Priority

Preferred priority:

1. Published Campus Agent guideline
2. Current official policy/memo
3. Current handbook section
4. Structured university data
5. AI explanation

If a published admin-reviewed guide exists, it may be preferred for student-facing explanations while still referencing original source material.

---

# 56. Conflicting Documents

If two documents conflict:

Check:

- effective date
- status
- archival state
- updated memo/policy

Do not silently merge incompatible instructions.

If unresolved:

AI should explain that sources conflict and recommend verifying with the responsible office.

---

# 57. Source Reference Structure

Suggested type:

```ts
type SourceReference = {
  type: "document" | "office" | "event" | "announcement" | "guideline";
  id: string;
  title: string;
  section?: string;
  page?: number;
};
```

---

# 58. Source Display

Student-facing references may display:

Student Handbook 2026

Section 5.3 — Incomplete Grades

Registrar Memo 2026-04

Completion of INC Guidelines

Office of the Registrar

Official Office Information

---

# 59. Admin AI Assistant

Admin AI can assist with:

- document summaries
- extracting requirements
- extracting procedures
- drafting guideline steps
- identifying likely category
- connecting responsible office
- comparing updated documents

---

# 60. Admin AI Workflow

Example:

Admin uploads Registrar memo.

↓

Document becomes ready.

↓

Admin selects:

"Create guideline from document"

↓

Claude receives relevant text.

↓

Claude proposes:

Title:

Completion of Incomplete Grade

Category:

INC / Grades

Requirements:

[...]

Steps:

[...]

Responsible Office:

Registrar

↓

Save as Draft.

↓

Admin reviews.

↓

Admin publishes manually.

---

# 61. Admin AI Restrictions

AI output must never automatically become public.

All AI-generated guideline content:

status = draft

Admin must explicitly publish.

---

# 62. Admin Dashboard

Dashboard may display:

- total published guides
- draft guides
- active documents
- upcoming events
- current announcements
- recently updated content

Avoid complex analytics for MVP.

---

# 63. Documents Page

Should show:

- document title
- type
- upload date
- ingestion status
- source status
- effective date
- actions

Possible actions:

- View
- Process
- Reprocess
- Archive
- Create Guideline

---

# 64. Events Admin

Admin can:

- create
- edit
- publish
- cancel
- archive events

Use validated forms.

---

# 65. Announcements Admin

Admin can:

- create
- edit
- publish
- archive announcements

---

# 66. Offices Admin

Admin can:

- create office
- edit office head
- edit office hours
- connect campus location

---

# 67. Campus Locations Admin

Admin can:

- create location
- edit building details
- assign map position
- connect offices

---

# 68. System Settings

MVP settings may contain:

- university name
- assistant name
- university short name
- logo
- basic branding

Example:

university_name:

Wesleyan University Philippines

assistant_name:

Wesleyan Agent

---

# 69. White-Label Behavior

Default platform:

Campus Agent

Deployment can override branding.

Example:

Campus Agent

→ Wesleyan Agent

Core components should not assume a specific school name where configuration can be used instead.

---

# 70. Initial Database Entities

Expected MVP tables:

- profiles
- departments
- programs
- offices
- campus_locations
- events
- announcements
- guideline_categories
- guidelines
- guideline_steps
- documents
- document_chunks
- conversations
- messages
- system_settings

---

# 71. Possible Relationships

profiles.department_id

→ departments.id

profiles.program_id

→ programs.id

programs.department_id

→ departments.id

offices.campus_location_id

→ campus_locations.id

guidelines.category_id

→ guideline_categories.id

guidelines.responsible_office_id

→ offices.id

guideline_steps.guideline_id

→ guidelines.id

document_chunks.document_id

→ documents.id

conversations.user_id

→ profiles.id

messages.conversation_id

→ conversations.id

---

# 72. Potential Guideline-Document Relationship

A guideline may reference multiple documents.

Use junction table if needed:

guideline_sources

Fields:

- guideline_id
- document_id
- section_reference
- page_reference

Do not implement unless useful during schema design.

---

# 73. RLS — Profiles

Users:

- read own profile
- update only full_name, user_type, intended_department_id, intended_program_id (column grants + own-row RLS)

Admin:

- broader read access where necessary

Role field must never be editable by users. Profiles are created only by the signup trigger.

---

# 74. RLS — Conversations

Students:

- read own conversations
- create own conversations
- delete own conversations if supported

Students must not access other students' conversation history.

---

# 75. RLS — Messages

Students:

- access messages belonging to their own conversations

---

# 76. RLS — Public Content

Published public content may be readable by anonymous users where appropriate.

Examples:

- public events
- public announcements
- public guides
- public offices

---

# 77. RLS — Admin Content

Create/update/delete operations for official content must require admin role.

---

# 78. Storage

Supabase Storage may contain:

- documents
- branding assets
- campus map images

Suggested buckets:

documents

public-assets

Do not expose internal documents publicly unless intended.

---

# 79. Security

Required:

- server-side API keys
- authenticated admin operations
- RLS
- validated uploads
- validated forms
- no service-role key in browser
- no Claude/OpenAI keys in client bundle

---

# 80. Rate Limiting

AI endpoints should eventually support basic protection.

For MVP:

consider basic per-user/session limits.

Do not allow uncontrolled public AI usage if it risks API cost abuse.

---

# 81. Public AI Limitations

Guests (signed out) use an anonymous database client: only public, published, Ready knowledge, public events/announcements, offices, programs and campus locations. Draft and archived content is never used, by guests or users.

Allowed: admission, enrollment, freshman/transferee requirements, programs, scholarships, academic calendar, offices, campus map, events, announcements, basic policies (dress code, INC, honors… when published), university services.

Not allowed: lookups of a person's own record ("what are my grades"). These get a fixed reply pointing to the responsible office, with no AI call.

## 81.1 Guest question limit

- 3 successful questions per guest
- counted on the server in a signed, httpOnly cookie (`ca_guest`, HMAC with `GUEST_SESSION_SECRET`): a refresh can't reset it and the browser can't edit it. Clearing cookies does reset it: this is casual-reset protection, not anti-fraud
- counted: any answered, partial or not-found answer
- not counted: failed AI requests, server errors, empty/invalid submissions, rate-limited requests, instant local replies (greetings, off-topic, gibberish)
- signed-in users have no limit
- the guest chat is temporary (in-page only) and is not saved

---

# 82. AI Cost Efficiency

Use retrieval before generation.

Avoid:

- entire handbook in every prompt
- unnecessary long chat history
- repeated large document content
- excessive output tokens

Use concise relevant context.

---

# 83. Error Handling

If AI fails:

Show:

"Campus Agent could not complete this request right now."

If retrieval returns no source:

Show:

"I couldn't find a verified university source for this question yet."

If a document fails ingestion:

Admin should see:

Processing Failed

with retry action.

---

# 84. Empty States

Examples:

School Guides:
"No published guides yet."

Events:
"No upcoming events found."

Announcements:
"No active announcements."

Recent Conversations:
"No conversations yet."

Documents:
"No documents uploaded yet."

---

# 85. Loading States

Use:

- skeletons
- status indicators
- document processing state
- AI thinking indicator

Avoid blocking the full application unnecessarily.

---

# 86. Mobile Behavior

Student app must work well on mobile.

Desktop sidebar may collapse into:

- drawer
- sheet
- mobile nav

AI process steps should remain readable.

---

# 87. Admin Responsive Behavior

Admin dashboard is primarily desktop-first.

Tablet support required.

Mobile admin optimization is not a core MVP priority.

---

# 88. Initial Data Sources

Current expected initial university data:

1. Student Handbook PDF
2. University Calendar of Activities
3. Official Campus Map
4. Office directory information
   - office name
   - office head
   - office hours
   - location

---

# 89. Initial Data Import Strategy

## Handbook

Use:

RAG/document ingestion


## Calendar of Activities

Convert to:

events table


## Campus Map

Convert to:

campus_locations


## Offices

Convert to:

offices table

---

# 90. Real Data Review

Before importing real university files:

1. Inspect source quality.
2. Identify missing fields.
3. Identify duplicates.
4. Determine public vs authenticated visibility.
5. Identify outdated information.
6. Preserve source references.

---

# 91. Development Order

Do not build all modules simultaneously.

Recommended implementation sequence:

1. Documentation
2. Database schema
3. Auth
4. Profiles/roles
5. Core admin data
6. Student UI shell
7. Admin UI shell
8. Offices
9. Events
10. Announcements
11. Campus locations
12. Guidelines
13. Document ingestion
14. Embeddings
15. RAG
16. Claude integration
17. Admin AI
18. Public AI
19. Deployment

---

# 92. Schema Design Rule

Before creating the schema:

Review:

- docs/plan.md
- docs/skills.md
- docs/system-spec.md

Then produce a proposed schema first.

Do NOT immediately execute migrations.

The schema should be reviewed before applying.

---

# 93. UI Implementation Rule

Use UI references as design guidance.

Do not copy external products exactly.

Student UI:

AI-first conversational workspace.

Admin UI:

internal CMS/dashboard.

---

# 94. No Request Processing

Important:

Campus Agent must not introduce "My Requests" unless scope changes.

The system may explain:

"How to request a TOR"

but it does NOT:

submit the TOR request.

---

# 95. No Fake Integration

Do not imply Campus Agent is integrated with:

- SIS
- payment gateway
- Registrar backend
- grading system

unless an actual integration exists.

---

# 96. Official Data Label

Student-facing AI may display:

"Based on official university information"

only when relevant verified sources were actually retrieved.

---

# 97. Demo Mode

For hackathon demo:

Use real university sources where permitted.

Ensure demo questions have known verified answers.

Preferred scenarios:

- INC
- Dean's List
- enrollment
- Registrar location
- office hours
- university event date

---

# 98. Primary Success Condition

Campus Agent succeeds when the student can move from:

"I don't know what to do."

to:

"I know the next steps, where to go, and where this information came from."

---

# 99. Core System Principle

Campus Agent should connect:

Official university knowledge

+

structured campus data

+

AI reasoning

into one reliable student-facing navigation experience.

---

# 100. Final Implementation Rule

Do not optimize for number of features.

Optimize for:

- correctness
- verified sources
- useful guidance
- secure access
- stable demo experience
- clean UI
