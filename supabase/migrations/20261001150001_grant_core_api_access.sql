-- Campus Agent MVP schema, migration 1b: Data API access for the core tables.
-- This project does not grant table privileges to `anon` / `authenticated` by default,
-- so each table gets explicit, minimal grants. RLS policies still decide which rows are visible.

grant select on public.departments, public.programs, public.campus_locations, public.offices
  to anon, authenticated;
grant insert, update, delete on public.departments, public.programs, public.campus_locations, public.offices
  to authenticated;                                            -- admin-only via RLS

-- Profiles: signed-in users read (own row via RLS); column-level update grant already exists.
grant select on public.profiles to authenticated;
