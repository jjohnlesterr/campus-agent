-- Campus Agent MVP schema, migration 1 of 4: core schema.
-- Source: docs/schema-proposal.md (revision 2) §5.1, §5.2, §5.6–§5.8.
-- Private helpers, enums, organization/campus/profile tables, signup trigger, admin check, RLS.

-- ---------- Private schema and helper ----------
-- Helpers live in a schema the Supabase API does not expose, so they can't be called as RPC.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Enums ----------
create type public.app_role as enum ('student', 'admin');
create type public.content_visibility as enum ('public', 'authenticated');
create type public.publish_status as enum ('draft', 'published', 'archived');      -- guidelines, announcements
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.announcement_category as enum (
  'general', 'academic', 'registrar', 'enrollment',
  'scholarship', 'department', 'campus', 'emergency'
);
create type public.document_type as enum ('handbook', 'memo', 'policy', 'guideline', 'calendar', 'form', 'other');
create type public.document_status as enum ('uploaded', 'processing', 'ready', 'failed', 'archived');
create type public.message_role as enum ('user', 'assistant');

-- ---------- Tables ----------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- e.g. 'CCS'
  name        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.programs (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  code          text not null unique,        -- e.g. 'BSIT'
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.campus_locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  building_name text,
  floor         text,
  description   text,
  map_x         numeric(5, 2) check (map_x between 0 and 100),   -- % position on the official map (spec §30)
  map_y         numeric(5, 2) check (map_y between 0 and 100),
  image_path    text,                                            -- path in public-assets bucket
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.offices (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  short_name         text,
  description        text,
  head_name          text,
  head_title         text,
  office_hours       text,                                       -- e.g. 'Mon–Fri, 8:00 AM – 5:00 PM'
  campus_location_id uuid references public.campus_locations (id) on delete set null,
  contact_email      text,
  contact_phone      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.app_role not null default 'student',
  email         text,                                           -- copied from auth.users at signup
  full_name     text,
  student_id    text unique,
  department_id uuid references public.departments (id) on delete set null,
  program_id    uuid references public.programs (id) on delete set null,
  year_level    smallint check (year_level between 1 and 6),
  avatar_url    text,
  onboarded_at  timestamptz,                                    -- null until onboarding is completed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Indexes (foreign keys) ----------
create index programs_department_id_idx     on public.programs (department_id);
create index offices_campus_location_id_idx on public.offices (campus_location_id);
create index profiles_department_id_idx     on public.profiles (department_id);
create index profiles_program_id_idx        on public.profiles (program_id);

-- ---------- Triggers ----------
do $$
declare
  t text;
begin
  foreach t in array array['departments', 'programs', 'campus_locations', 'offices', 'profiles'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- Every signup gets a student profile. Role is never read from signup data.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- Admin check ----------
-- The single source of truth for admin access, used by every admin policy.
-- security definer so it can read profiles without recursing into profiles' own RLS.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- ---------- Row Level Security ----------
do $$
declare
  t text;
begin
  foreach t in array array['departments', 'programs', 'campus_locations', 'offices', 'profiles'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Simple admin CRUD on official content (spec §77)
  foreach t in array array['departments', 'programs', 'campus_locations', 'offices'] loop
    execute format('create policy "Admins can insert %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- Open directory data: everyone, including the public landing page
create policy "Anyone can read departments"      on public.departments      for select to anon, authenticated using (true);
create policy "Anyone can read programs"         on public.programs         for select to anon, authenticated using (true);
create policy "Anyone can read campus locations" on public.campus_locations for select to anon, authenticated using (true);
create policy "Anyone can read offices"          on public.offices          for select to anon, authenticated using (true);

-- Profiles (spec §73)
create policy "Users read own profile; admins read all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Students may only write their onboarding fields — never role or email.
-- Profiles are created by the signup trigger and removed when the auth user is deleted.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, student_id, department_id, program_id, year_level, avatar_url, onboarded_at)
  on public.profiles to authenticated;
