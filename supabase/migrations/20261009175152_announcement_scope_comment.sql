-- Announcement scope uses the existing announcements.department_id: null = University-wide,
-- otherwise the department the announcement is for. No data changes (the existing
-- announcements already have department_id = null, i.e. University-wide).
comment on column public.announcements.department_id is 'Announcement scope: null = University-wide; otherwise the department it is for. The app offers only enabled departments (lib/announcement-scopes.ts; CECT for now).';
