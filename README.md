# Campus Agent

Campus Agent is an AI-powered university information and process navigator designed primarily for incoming freshmen and campus visitors/prospective students. It helps them quickly understand admission, enrollment, programs, campus offices, policies, events, and university services.

Instead of searching through long handbooks, scattered announcements, or different university offices, they get concise, source-backed answers based on verified university information.

---

## Problem

Incoming freshmen and visitors often struggle to find clear and reliable answers to simple university-related questions.

Common problems include:

- important information being scattered across handbooks, PDFs, announcements, and offices
- long university documents being difficult to search and understand
- not knowing which office handles a concern
- being unsure about required steps or documents
- outdated or conflicting information
- feeling hesitant to repeatedly ask university staff for simple questions
- unnecessary time spent searching for answers that should be easy to access

A simple campus question should not feel like a campus-wide search mission.

---

## Solution

Campus Agent provides one centralized AI-assisted platform where freshmen and visitors can ask university-related questions and receive clear answers based only on verified school information.

The system can help them understand:

- admission and freshman / transferee requirements
- enrollment procedures
- programs and courses
- scholarships and the academic calendar
- document requests
- published policies such as INC or graduation honors
- academic policies
- dress code and university rules
- office locations
- university events
- announcements
- campus locations

Campus Agent retrieves relevant information from approved university sources before generating an answer.

If the available sources do not contain enough information, the system avoids guessing and tells the user that the requested information is not available in its verified references.

---

## Core Features

### AI Campus Assistant

Guests and signed-in users can ask questions naturally and receive concise, easy-to-follow answers.

The AI:

- retrieves relevant university information first
- answers using verified sources
- provides source references when available
- uses numbered steps for procedures
- avoids inventing policies or requirements
- declines unrelated questions outside the university knowledge base

Example questions:

- How do I enroll?
- How do I complete an INC?
- What are the requirements for graduation honors?
- How can I request my Transcript of Records?
- Where is the Registrar's Office?
- What events are scheduled for my department?

---

### Knowledge Base

University information is organized into easy-to-read guides.

Administrators can manage guides containing information such as:

- procedures
- requirements
- academic policies
- student services
- university rules

Users can browse these guides even without asking the AI.

---

### Source Management

Administrators can upload official university documents such as PDFs.

Uploaded sources can be:

1. stored securely
2. processed and extracted
3. divided into useful sections
4. linked to page references
5. used as verified knowledge for Campus Agent

The system is designed so that updated sources can replace older information used by the AI.

---

### Events

Administrators can create and manage university events.

Users can view:

- university-wide events
- department-specific events
- dates
- times
- venues
- descriptions

---

### Announcements

Administrators can publish university and department announcements.

Users see announcements for their intended college first while still having access to university-wide information.

---

### Campus Map

Campus Agent includes university building and office information.

Users can ask questions such as:

> Where is the Registrar?

Campus Agent can identify the appropriate building and direct the user to the campus map.

---

### Guest Access and Accounts

Anyone can ask Campus Agent from the landing page without signing in. Guests get **3 free successful questions**, counted on the server in a signed, httpOnly cookie. Failed AI requests, server errors, empty submissions and instant local replies (greetings, off-topic) don't count. After the third answer, the ask box is replaced by a friendly prompt to create an account or sign in.

Anyone with a valid email can sign up (`/signup`):

- full name, email, password
- user type: **Incoming Freshman** or **Visitor**
- optional intended college and program

Signed-in users keep their conversation history and can use Guides, Events, Announcements, Campus Map and How It Works. Their intended college/program only personalizes ranking; it never restricts what they can browse.

There are two account roles: **user** and **admin**. Freshman/visitor is a profile field (`profiles.user_type`), not a role. For backward compatibility the database keeps the internal role value `student` for every non-admin account, and the UI shows it as "User". Public sign-up always creates a user: the role is set by a database trigger and is never read from the form. Admin accounts cannot be created through sign-up.

Accounts created before public sign-up (student ID, department, program, year level, temporary passwords) keep working; those columns are now optional.

---

### Administration

Authorized administrators can manage university information through the administration dashboard.

Admin modules include:

- Dashboard
- Knowledge Base
- Sources
- Events
- Announcements
- Campus Map
- Users (registered freshmen and visitors; manual account creation is a secondary option)
- Settings

Admin access is role-protected and is not exposed as a public admin login.

### Environment

Besides the Supabase and AI keys, the guest question limit signs its cookie with `GUEST_SESSION_SECRET` (server-only). If it isn't set, a key derived from `ANTHROPIC_API_KEY` is used.

If Supabase Auth has **Confirm email** enabled, new users are asked to open the confirmation link (it returns to `/auth/confirm`). Otherwise they go straight to `/app`. Set `NEXT_PUBLIC_APP_URL` in production so confirmation links point to the deployed site.

Run tests with `npm test`.

---

## How Campus Agent Works

```text
Guest or User Question
      ↓
Search Verified University Sources
      ↓
Retrieve Relevant Sections
      ↓
Send Retrieved Context to Claude
      ↓
Generate Grounded Answer
      ↓
Display Answer + Source Reference