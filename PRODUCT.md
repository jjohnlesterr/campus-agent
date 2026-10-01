# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Enrolled students** (primary): signed in with a school account, usually on a phone between classes or at home, trying to get an official process done — fixing an INC grade, enrolling, clearance, finding the Registrar and when it is open.
- **Public visitors**: prospective and new students, parents, visitors asking general questions (admissions, enrollment, offices, public events) without an account.
- **University admins** (single Super Admin role in the MVP): office staff maintaining the verified knowledge base, documents, events, announcements, offices and campus locations on a desktop.

## Product Purpose

Campus Agent turns scattered official university information (handbook, memos, office directory, calendar of activities, campus map) into clear, step-by-step guidance with sources. Success: a student moves from "I don't know what to do" to "I know the next steps, where to go, and where this information came from."

## Positioning

Not a generic chatbot: answers are grounded in admin-verified university sources and structured campus data, shown as process steps, requirements, responsible office, location/hours and citations. When no verified source exists it says so and points to the right office instead of guessing.

## Operating Context

- Student answers come from: published guidelines (admin-reviewed), the student handbook (RAG), and structured tables for offices, events, announcements and campus locations.
- Admins upload official PDFs, review AI-drafted guidelines, and publish; AI output is never auto-published.
- Department/program personalizes ranking only; students can still browse every department's content.
- Campus Agent guides processes but never submits requests or transactions (no "My Requests").

## Capabilities and Constraints

- Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui (Base UI, Nova preset), Supabase (Auth, Postgres, pgvector, Storage), Claude for reasoning, OpenAI embeddings; deployed on Vercel.
- Roles: `student` and `admin` only; no role selector at login; admin access granted in the database.
- Public AI is limited to content marked public; it keeps no conversation history.
- Out of scope for the MVP: transactions, SIS integration, payments, notifications, OCR, multi-tenancy.
- Product source of truth: `docs/plan.md`, `docs/skills.md`, `docs/system-spec.md`.

## Brand Commitments

- Default product name **Campus Agent**; white-label ready (e.g. "Wesleyan Agent") through `system_settings` — never hardcode a school name in reusable components.
- User-pinned direction: minimal, professional, academic, trustworthy; restrained blue/neutral palette; subtle borders and shadows; no gradients, glassmorphism, glow, mascots or decorative AI clutter; not every section a large rounded card.
- Voice: calm, plain, precise; states clearly when information is unavailable.

## Evidence on Hand

- No real university data is loaded yet (handbook, offices, calendar, map pending). Department/program seed data is a draft to be verified against the official list.
- No testimonials, usage numbers, partner logos or accuracy claims exist — never fabricate them.

## Product Principles

1. Verified information over fluent answers; cite sources, admit gaps.
2. Structured guidance (steps, requirements, office) beats chat prose.
3. Admins stay in control of what students see.
4. Simple, reliable core before additional features.
5. Personalize without restricting.

## Accessibility & Inclusion

Student experience must work well on mobile. Accessible forms, labels, keyboard navigation, visible focus, and sufficient contrast (see `docs/skills.md` §23).
