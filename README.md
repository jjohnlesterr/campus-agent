# Campus Agent

Campus Agent is an AI-powered university information and process navigator designed to help students quickly understand campus procedures, requirements, offices, announcements, events, and other important university information.

Instead of making students search through long handbooks, scattered announcements, or different university offices, Campus Agent provides concise, source-backed answers based on verified university information.

---

## Problem

Students often struggle to find clear and reliable answers to simple university-related questions.

Common problems include:

- important information being scattered across handbooks, PDFs, announcements, and offices
- long university documents being difficult to search and understand
- students not knowing which office handles a concern
- students being unsure about required steps or documents
- outdated or conflicting information
- students feeling hesitant to repeatedly ask university staff for simple questions
- unnecessary time spent searching for answers that should be easy to access

A simple campus question should not feel like a campus-wide search mission.

---

## Solution

Campus Agent provides one centralized AI-assisted platform where students can ask university-related questions and receive clear answers based only on verified school information.

The system can help students understand:

- enrollment procedures
- INC / incomplete grade requirements
- graduation requirements
- document requests
- academic policies
- dress code and university rules
- office locations
- university events
- announcements
- campus locations

Campus Agent retrieves relevant information from approved university sources before generating an answer.

If the available sources do not contain enough information, the system avoids guessing and tells the student that the requested information is not available in its verified references.

---

## Core Features

### AI Campus Assistant

Students can ask questions naturally and receive concise, student-friendly answers.

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

Students can browse these guides even without asking the AI.

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

Students can view:

- university-wide events
- department-specific events
- dates
- times
- venues
- descriptions

---

### Announcements

Administrators can publish university and department announcements.

Students can browse announcements relevant to their department while still having access to university-wide information.

---

### Campus Map

Campus Agent includes university building and office information.

Students can ask questions such as:

> Where is the Registrar?

Campus Agent can identify the appropriate building and direct the student to the campus map.

---

### Student Accounts

Students can create an account and access a personalized Campus Agent experience.

Student information may include:

- name
- student ID
- department
- program
- year level

Department information is used to personalize events and announcements.

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
- Users
- Settings

Admin access is role-protected and is not exposed as a public admin login.

---

## How Campus Agent Works

```text
Student Question
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