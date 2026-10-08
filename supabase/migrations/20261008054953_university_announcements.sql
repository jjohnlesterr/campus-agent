-- University-wide announcements; the Events module leaves the active product.
--
-- Non-destructive:
-- - events is kept, unchanged, for history (the app no longer reads or writes it).
-- - announcements.department_id is kept for compatibility but no longer used: every
--   announcement is university-wide.
-- - announcements.source stays as the free-text source label (e.g. the official
--   Facebook page name); source_url is new and optional.
-- - category becomes optional text with a small, easy-to-change list. Old enum values
--   are mapped (registrar/campus → campus_services, department → general); the
--   announcement_category type is left in place, unused.
-- - Announcements are official public notices for incoming freshmen and visitors, so
--   they are public: the public assistant and signed-in users both see Published ones.

alter table public.announcements alter column category drop default;
alter table public.announcements alter column category type text using (
  case category::text
    when 'registrar' then 'campus_services'
    when 'campus' then 'campus_services'
    when 'department' then 'general'
    else category::text
  end
);
alter table public.announcements alter column category drop not null;
alter table public.announcements add constraint announcements_category_check check (
  category in ('academic', 'enrollment', 'scholarship', 'advisory', 'campus_services', 'university_activity', 'emergency', 'general')
);

alter table public.announcements add column source_url text check (
  source_url is null or (source_url ~* '^https?://[^\s]+$' and char_length(source_url) <= 2000)
);
comment on column public.announcements.source is 'Optional source label, e.g. the official university Facebook page.';
comment on column public.announcements.source_url is 'Optional link to the original post or notice. Entered by admins; never scraped.';
comment on column public.announcements.department_id is 'Unused since announcements became university-wide. Kept for compatibility.';

alter table public.announcements alter column visibility set default 'public';
update public.announcements set visibility = 'public' where visibility <> 'public';

-- Newest Published first (student list and Campus Agent lookups).
create index announcements_status_publish_at_idx on public.announcements (status, publish_at desc);

comment on table public.events is 'Retired: the Events module was removed from the product. Kept for history; not read by the app.';
