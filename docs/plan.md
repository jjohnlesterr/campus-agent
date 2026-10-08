# Campus Agent — Development Plan

> **Product change (2026-10-08):** the Events module is retired. University-wide **Announcements** (optional category, published date, optional source label/URL; no department targeting) now carry current notices — enrollment schedules, suspensions, advisories, scholarship reminders and official university activities. Campus Agent answers time-sensitive questions from Published announcements first. Sections below that describe Events or department-specific announcements are historical. The `events` table is kept, unused.

## 1. Project Overview

Campus Agent is an AI-powered university information and process navigator designed primarily for incoming freshmen and campus visitors/prospective students. It helps them find, understand, and follow official school procedures.

> **Direction update (Oct 2026):** the primary audience is incoming freshmen and visitors, no longer only enrolled students. Guests can ask 3 free questions on the landing page; anyone can then sign up (any email) with just a name, email and password. Roles are only user and admin. See docs/system-spec.md §4, §5 and §81.

It is not intended to function as a generic chatbot.

Instead of simply answering questions conversationally, Campus Agent should retrieve verified university information and transform it into clear, actionable guidance such as:

- step-by-step procedures
- requirements
- responsible offices
- office locations
- office hours
- relevant events
- relevant announcements
- official references and sources

Example:

Student asks:

"How do I fix an INC grade?"

Campus Agent should return:

1. Contact the instructor.
2. Complete the missing requirements.
3. Submit the required completion form.
4. Wait for grade processing.
5. Verify the updated grade.

Along with:

- responsible office
- office hours/location when relevant
- source document
- handbook section or memo reference

The system should prioritize verified university information and avoid generating unsupported school-specific procedures.


---

# 2. Product Model

Campus Agent consists of three experiences:

1. Public Experience
2. Student Experience
3. Internal Admin System


---

# 3. Public Experience

The public side is accessible without an account.

Its purpose is to allow prospective students, new students, parents, and visitors to access general university information.

## Public AI Access

Users may ask questions about public information such as:

- enrollment
- admission requirements
- scholarship overview
- general school procedures
- university offices
- office hours
- campus locations
- public events
- general announcements

The public AI must only access information marked as public.

It must not provide personalized student information.

## Public Landing Page

The landing page should include:

- Campus Agent branding
- short explanation of the platform
- AI question input
- popular topics
- enrollment information
- admissions
- scholarships
- campus offices
- upcoming public events
- login button for enrolled students

Example placeholder:

"Ask Campus Agent about enrollment, school processes, or campus services..."


---

# 4. Student Experience

Users sign up themselves with any valid email address and a password (Supabase Auth). Sign-up asks only for full name, email and password; Incoming Freshman / Visitor and intended college/program can be set later on the profile.

Student ID, school email and year level are no longer required. Older admin-created accounts keep working.

Guests can ask 3 free successful questions before being asked to create an account or sign in.

There should be no "Login as Student" / "Login as Admin" selector.

The system determines the user's access based on their account role.


---

# 5. Student Profile

Each authenticated student should have a profile containing:

- full name
- student ID
- school email
- college/department
- program
- year level
- profile image if available

For the MVP, department/program/year level may be selected or entered during onboarding.

In a production implementation, these values should ideally come from official student records.


---

# 6. Department Personalization

The student's assigned department/program is used for personalization.

Examples:

- relevant department announcements
- department events
- program-specific information
- department-specific procedures

However:

Department should be used primarily for personalization, not as a strict browsing restriction.

Students may still view public events and announcements from other departments.

Example:

A BSIT student will see BSIT-related events first but may still browse Tourism, Engineering, Nursing, or university-wide events.


---

# 7. Student Navigation

Recommended student sidebar/navigation:

- New Conversation
- School Guides
- Offices
- Events
- Announcements
- Campus Map
- How It Works

Below the primary navigation:

- Recent Conversations

Do NOT include:

- My Requests
- Request Tracking
- Transaction Processing

Campus Agent guides students through processes but does not submit official requests on their behalf.


---

# 8. AI Conversation Experience

The AI interface should resemble a modern assistant interface but should focus on university processes.

The AI should not respond like a generic chatbot when a structured process exists.

Example question:

"How do I file a Leave of Absence?"

Preferred output:

## Leave of Absence Process

Step 1  
Get the Leave of Absence form.

Step 2  
Have your adviser sign the form.

Step 3  
Attach supporting documents.

Step 4  
Submit the requirements to the Registrar.

Step 5  
Wait for approval.

Additional information:

- Office: Registrar
- Location
- Office hours
- Required forms
- Sources
- Related policy


---

# 9. Structured AI Answer Types

Campus Agent should support multiple answer formats.

## Process Answer

Used for:

- resolving INC
- clearance
- enrollment
- shifting
- leave of absence
- graduation requirements
- document procedures

Should contain:

- title
- short explanation
- steps
- requirements
- responsible office
- source references


## Direct Information Answer

Used for:

- office hours
- office head
- campus location
- event date
- announcement details


## Combined Answer

Used when information comes from several sources.

Example:

"How do I fix my INC and where should I go?"

Campus Agent may combine:

- handbook policy
- Registrar information
- campus location
- office hours


---

# 10. Recent Conversations

Authenticated users should have conversation history.

The sidebar may show examples such as:

- How to fix an INC grade
- Dean's List requirements
- How to enroll
- Where is the Registrar
- Graduation requirements

For the MVP, conversations may be stored in Supabase.


---

# 11. School Guides

School Guides provide a browsable alternative to AI.

Students should not be forced to ask the AI for everything.

Possible categories:

- Enrollment
- Academic Records
- INC / Grades
- Scholarships
- Clearance
- Leave of Absence
- Graduation
- Document Requests
- Student Policies

Each guide may contain:

- title
- description
- steps
- requirements
- responsible office
- related forms
- source
- last updated date


---

# 12. Offices

Campus Agent will maintain structured information about school offices.

Office information may contain:

- office name
- office head
- office hours
- location
- contact information if available
- description
- related processes

Example:

Office of the Registrar

Head:
[Name]

Office Hours:
Monday-Friday
8:00 AM-5:00 PM

Location:
Administration Building

Related Processes:
- enrollment
- records
- INC
- graduation
- document requests


---

# 13. Campus Map

Campus Agent should include a simple campus navigation feature.

The university map may be used to identify:

- buildings
- offices
- auditorium
- gym
- library
- clinic
- departments
- student service areas

For the MVP, locations may be manually encoded based on the official campus map.

The AI should be able to reference these locations.

Example:

"Where is the Registrar?"

Campus Agent:

"The Office of the Registrar is located at..."

With:

[View on Campus Map]


---

# 14. Events

Events should be stored as structured database records rather than embeddings.

Possible fields:

- title
- description
- date
- start time
- end time
- venue
- department
- audience
- event type
- visibility
- source
- created by
- updated at

Visibility examples:

- university-wide
- department
- program
- year level
- public


---

# 15. Calendar of Activities

The official university calendar of activities will be converted into structured event records.

Students should be able to:

- browse upcoming events
- filter events
- see department events
- see university-wide activities
- ask the AI about schedules

Example questions:

"What events are happening this week?"

"When is Foundation Week?"

"Do we have a BSIT event this month?"

"When are midterms?"


---

# 16. Announcements

Announcements should also use structured database records.

Possible fields:

- title
- content
- category
- department
- visibility
- publish date
- expiration date
- source
- status

Possible categories:

- academic
- enrollment
- registrar
- department
- scholarship
- campus
- emergency
- general


---

# 17. Internal Admin System

The admin experience is separate from the student experience.

It should feel like an internal university knowledge management system.

The admin UI should use a desktop-first dashboard layout.

Recommended sidebar:

- Dashboard
- Knowledge Base
- Documents
- Events
- Announcements
- Offices
- Campus Locations
- AI Assistant
- Settings


---

# 18. Admin Authentication

There should be no public "Sign in as Administrator" option.

Admin access is granted to specific authorized accounts.

Example:

student@school.edu
role = student

authorized.admin@school.edu
role = admin

After authentication:

student
→ /app

admin
→ /admin

Students must never be able to access protected admin routes simply by typing the URL.


---

# 19. Admin Role for MVP

The MVP will use only:

- Super Admin

The Super Admin can manage all Campus Agent content.

Possible future roles:

- Registrar Admin
- Department Admin
- Scholarship Admin
- Admissions Admin
- Super Admin

Future role permissions may limit administrators to specific categories or departments.

Do NOT implement complex RBAC for the MVP unless necessary.


---

# 20. Knowledge Base

The Knowledge Base is the most important admin module.

It should allow administrators to manage the verified information Campus Agent uses.

Knowledge categories may include:

- Enrollment
- Academic Records
- INC / Grades
- Scholarships
- Clearance
- Leave of Absence
- Graduation
- Document Requests
- Student Policies


---

# 21. Knowledge Base UI

The Knowledge Base should use a management interface inspired by modern CMS applications.

Possible layout:

Left:
- admin sidebar

Secondary panel:
- categories

Main content:
- search
- filters
- guideline cards
- Upload Document
- Create Guideline

Each guideline card may display:

- title
- category
- status
- number of steps
- responsible office
- source
- last updated date

Statuses:

- Draft
- Published
- Archived


---

# 22. Manual Guideline Creation

Administrators should be able to manually create a guideline.

Suggested fields:

- title
- category
- description
- requirements
- process steps
- responsible office
- related forms
- effective date
- source
- visibility
- status

Actions:

- Save Draft
- Publish
- Edit
- Archive


---

# 23. Document Upload

Admins may upload official documents such as:

- student handbook
- memorandums
- policies
- guidelines
- registrar documents

Initial supported formats:

- selectable-text PDF

Optional future support:

- scanned PDF
- images
- OCR


---

# 24. Document Processing Pipeline

Document ingestion flow:

Admin uploads document

→ Supabase Storage

→ text extraction

→ document cleaning

→ text chunking

→ embeddings

→ Supabase pgvector

→ searchable knowledge source


---

# 25. Admin AI Assistant

The admin system should also contain an AI assistant.

Its purpose is different from the student AI.

Possible functions:

- summarize a document
- turn a memo into student-friendly steps
- generate a draft guideline
- extract requirements
- identify related policies
- suggest categories
- compare updated policy against existing guideline

Example:

Admin uploads a memo.

AI:

"I found two potential procedures in this document:

1. INC Completion Process
2. Grade Correction Process

Would you like to create draft guidelines?"

The AI must NOT automatically publish generated content.

Admin review is required before publishing.


---

# 26. Verified Publishing Workflow

Preferred content workflow:

Official Document

→ AI-assisted extraction

→ Draft Guideline

→ Admin Review

→ Admin Edit

→ Publish

→ Available to Student AI


This ensures that the AI knowledge base remains administrator-controlled.


---

# 27. AI Architecture

Primary reasoning model:

Claude Sonnet 5 API

Claude will handle:

- intent understanding
- reasoning
- combining retrieved information
- process generation
- formatting answers
- determining relevant data sources
- generating admin drafts


---

# 28. RAG Architecture

RAG is required for handbook and policy retrieval.

Pipeline:

Document

→ Extract Text

→ Clean Text

→ Split into Chunks

→ Create Embeddings

→ Store Embeddings in pgvector

Student Question

→ Create Query Embedding

→ Search pgvector

→ Retrieve Relevant Chunks

→ Send Relevant Context to Claude

→ Generate Grounded Answer


---

# 29. Embeddings

Use an embeddings API for semantic retrieval.

Initial preferred option:

OpenAI text-embedding-3-small

Alternative:

Voyage embeddings

Embeddings should primarily be used for:

- handbook
- policies
- memos
- long-form university documents

Do NOT unnecessarily embed structured data such as:

- events
- office hours
- office heads
- department names
- campus locations


---

# 30. Structured Data vs RAG

Use RAG for:

- handbook
- policies
- memorandums
- long guidelines
- official documents

Use normal database queries for:

- events
- announcements
- offices
- office heads
- office hours
- campus locations
- student profiles

Claude may combine both sources in one response.


---

# 31. Example Multi-Source Query

Student asks:

"How do I fix an INC and where should I go?"

System:

1. Detect intent.
2. Search handbook RAG for INC rules.
3. Retrieve Registrar office record.
4. Retrieve Registrar location.
5. Retrieve office hours.
6. Send combined context to Claude.
7. Generate structured response.
8. Display sources.


---

# 32. Source References

Every school-specific AI answer should display relevant source references whenever possible.

Examples:

Student Handbook 2026
Section 5.3 — Incomplete Grades

Registrar Memorandum 2026-04

Office of the Registrar
Official Office Information


The AI should clearly distinguish between:

- official source information
- AI-generated explanation


---

# 33. Hallucination Reduction

Campus Agent should follow these rules:

- Prefer retrieved university information.
- Do not invent school policies.
- Do not invent deadlines.
- Do not invent office locations.
- Do not invent requirements.
- Do not claim missing information exists.
- Clearly state when information is unavailable.
- Direct students to the appropriate office when necessary.
- Include sources whenever possible.

If no verified information exists:

"I couldn't find an official Campus Agent source that answers this yet. You may contact the Office of the Registrar for confirmation."


---

# 34. White-Label Branding

Campus Agent is the default product name.

The platform should be designed so schools can customize:

- school name
- school logo
- colors
- assistant name
- campus map
- departments

Example:

Default:
Campus Agent

Possible WUP deployment:
Wesleyan Agent

Other university:
[University Name] Agent

Avoid hardcoding Wesleyan branding into core reusable components where possible.


---

# 35. Technology Stack

Frontend:
- Next.js
- TypeScript

UI:
- Tailwind CSS
- shadcn/ui
- Base UI
- Nova preset

Backend:
- Supabase

Database:
- PostgreSQL

Vector Database:
- pgvector

Authentication:
- Supabase Auth

File Storage:
- Supabase Storage

Main AI:
- Claude Sonnet 5 API

Embeddings:
- embeddings API

Deployment:
- Vercel


---

# 36. Development Tools

Development workflow includes:

- Claude CLI
- Pixel Crew
- Impeccable
- Supabase MCP

Claude CLI may assist with:

- implementation
- debugging
- architecture inspection
- refactoring
- testing

Supabase MCP should be used to inspect actual database state before making assumptions.


---

# 37. Initial Route Structure

Suggested route structure:

/

Public landing page

/login

Student authentication

/app

Student main application

/app/chat

AI conversation

/app/guides

School guides

/app/offices

Office directory

/app/events

Events

/app/announcements

Announcements

/app/map

Campus map

/app/profile

Student profile


/admin

Admin dashboard

/admin/knowledge

Knowledge Base

/admin/documents

Uploaded documents

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

System settings


---

# 38. Database Planning

The detailed schema will be designed before implementation.

Expected entities include:

- profiles
- departments
- programs
- offices
- campus_locations
- events
- announcements
- guidelines
- guideline_steps
- documents
- document_chunks
- conversations
- messages
- system_settings

Exact fields, relationships, indexes, and RLS policies should be defined in the system specification before database implementation.


---

# 39. Authentication and Authorization

Authentication must be implemented through Supabase Auth.

Minimum roles:

- student
- admin

Requirements:

- authenticated student routes
- protected admin routes
- server-side authorization where appropriate
- Supabase RLS
- no service-role credentials in client code
- no public admin signup


---

# 40. Supabase Security

Before production:

- enable Row Level Security
- define student access policies
- define admin access policies
- protect storage buckets
- protect private documents
- never expose service-role keys
- validate environment variables
- validate all admin operations server-side


---

# 41. MVP Scope

The first complete MVP should contain:

## Public

- landing page
- limited public Campus Agent
- general school information
- login


## Student

- authentication
- profile
- AI conversation
- structured process responses
- source references
- School Guides
- Offices
- Events
- Announcements
- Campus Map
- recent conversations


## Admin

- admin authentication
- dashboard
- Knowledge Base
- guideline CRUD
- document upload
- Events CRUD
- Announcements CRUD
- Offices CRUD
- Campus Locations CRUD
- admin AI assistant


## AI

- Claude API integration
- embeddings
- handbook ingestion
- vector search
- RAG
- structured AI responses
- source citations


---

# 42. Features Explicitly Out of Scope for MVP

Do NOT build these unless there is extra time:

- actual enrollment processing
- official TOR request submission
- payment processing
- clearance transaction processing
- SIS integration
- grade modification
- student academic record retrieval
- real-time Registrar transactions
- multi-school tenancy
- complex admin role hierarchy
- advanced analytics
- scanned-document OCR
- mobile native application
- push notifications
- complex workflow approvals


---

# 43. Development Phases

## Phase 1 — Foundation

Already completed / currently being completed:

- Next.js setup
- TypeScript
- Tailwind
- ESLint
- shadcn/ui
- Base UI preset
- Nova preset
- Claude CLI
- Pixel Crew
- Impeccable
- Supabase MCP
- Supabase JavaScript client
- environment variables

Next:

- Supabase browser/server clients
- connection verification
- pgvector verification
- project folder structure
- documentation


---

## Phase 2 — System Specification

Before feature development:

- finalize routes
- finalize student/admin permissions
- finalize entities
- design database schema
- design RLS rules
- define AI response formats
- define document lifecycle


---

## Phase 3 — Authentication

Build:

- login
- logout
- sessions
- protected routes
- profiles
- student role
- admin role
- admin route protection
- student onboarding


---

## Phase 4 — Core Database

Implement:

- profiles
- departments
- programs
- offices
- campus locations
- events
- announcements
- guidelines

Add:

- relationships
- indexes
- RLS


---

## Phase 5 — Core UI

Build reusable application shell.

Student:

- sidebar
- top bar
- conversation layout
- mobile responsiveness

Admin:

- dashboard shell
- sidebar
- management layouts
- tables/cards
- search/filter controls


---

## Phase 6 — Structured Campus Data

Populate:

- Wesleyan offices
- office heads
- office hours
- locations
- calendar of activities
- announcements
- departments
- campus locations


---

## Phase 7 — Knowledge Base

Build:

- guideline categories
- guideline creation
- editing
- steps
- publishing
- drafts
- source references
- search/filter


---

## Phase 8 — Document Ingestion

Implement:

- Supabase Storage
- PDF upload
- PDF validation
- text extraction
- text cleaning
- chunk generation
- document metadata
- ingestion status


---

## Phase 9 — Embeddings and pgvector

Implement:

- embedding generation
- vector storage
- similarity search
- retrieval testing
- metadata filtering
- source mapping


---

## Phase 10 — Claude Integration

Integrate Claude Sonnet 5.

Implement:

- API route/server action
- system prompt
- retrieved context
- structured response schema
- error handling
- token usage controls
- source handling


---

## Phase 11 — Campus Agent RAG

Connect:

Student question

→ intent detection

→ retrieval

→ structured database lookup

→ Claude

→ answer

→ citations

Test using real questions such as:

- How do I fix an INC?
- What are the Dean's List requirements?
- How do I enroll?
- Where is the Registrar?
- What time does the Registrar close?
- When is Foundation Week?
- Are there events for BSIT this week?


---

## Phase 12 — Admin AI Assistant

Implement:

- document summarization
- policy extraction
- draft guideline generation
- requirement extraction
- step generation

Require admin review before publishing.


---

## Phase 13 — Campus Map

Implement:

- map page
- location list
- office-location connection
- building information
- "View on Campus Map" actions

Keep MVP implementation lightweight.


---

## Phase 14 — Public Campus Agent

Add limited public AI access.

Restrict retrieval to:

- public policies
- enrollment
- admissions
- public offices
- public events
- public announcements


---

## Phase 15 — Quality and Safety

Test:

- hallucination behavior
- missing sources
- conflicting documents
- invalid questions
- prompt injection attempts
- unauthorized admin access
- student access boundaries
- expired documents
- missing office data


---

## Phase 16 — UI Polish

Use Pixel Crew and Impeccable to review:

- hierarchy
- spacing
- responsiveness
- accessibility
- typography
- consistency
- loading states
- error states

Design direction:

- minimal
- professional
- clean
- academic
- intentional
- restrained shadows
- subtle borders

Avoid:

- excessive gradients
- glassmorphism
- glowing effects
- giant cards
- excessive rounded containers
- mascots
- decorative AI-style clutter


---

## Phase 17 — Deployment

Deploy to Vercel.

Configure:

- production environment variables
- Supabase production URLs
- Claude API key
- embeddings API key
- deployment checks

Never expose private API keys to the browser.


---

## Phase 18 — Demo Preparation

Prepare demo data and reliable scenarios.

Recommended demo:

### Scenario 1
Student:
"How do I fix an INC?"

Show:
- process
- handbook source
- Registrar office

### Scenario 2
Student:
"Where is the Registrar and what time are they open?"

Show:
- office
- office head
- office hours
- campus map

### Scenario 3
Student:
"What activities are happening this week?"

Show:
- calendar database

### Scenario 4
Admin uploads a new memo.

Show:
- document upload
- AI extraction
- generated draft guideline
- admin review
- publish

### Scenario 5
Student asks the updated procedure.

Show that Campus Agent now uses the newly published information.


---

# 44. MVP Success Criteria

Campus Agent MVP is considered successful when:

1. A student can authenticate.
2. An authorized admin can authenticate.
3. Admin routes cannot be accessed by students.
4. The admin can manage official campus information.
5. A handbook can be uploaded and processed.
6. Handbook chunks can be stored as embeddings.
7. Student questions retrieve relevant handbook content.
8. Claude can transform retrieved content into structured guidance.
9. Answers show references.
10. Events can be queried.
11. Offices can be queried.
12. Campus locations can be queried.
13. The AI can combine several sources in one answer.
14. The system avoids inventing unsupported school-specific information.
15. The app is deployable through Vercel.


---

# 45. Core Product Principle

Campus Agent should always prioritize:

Verified university information
+
clear student guidance
+
source transparency

The goal is not to create another chatbot.

The goal is to create an intelligent university navigator that converts scattered university information into useful, actionable guidance.
