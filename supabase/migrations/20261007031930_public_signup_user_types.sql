-- Public self-signup for incoming freshmen and visitors.
--
-- Roles are unchanged: app_role stays ('student', 'admin'). 'student' is kept as the
-- internal value for every non-admin account (shown as "User" in the product) so no
-- existing policy, record or admin account is touched. Freshman / visitor is a profile
-- field, not a role. Legacy student columns (student_id, department_id, program_id,
-- year_level) are kept, nullable, for backward compatibility.

create type public.user_type as enum ('freshman', 'visitor');

alter table public.profiles
  add column user_type              public.user_type,
  add column intended_department_id uuid references public.departments (id) on delete set null,
  add column intended_program_id    uuid references public.programs (id) on delete set null;

create index profiles_intended_department_id_idx on public.profiles (intended_department_id);
create index profiles_intended_program_id_idx    on public.profiles (intended_program_id);

-- Every signup still gets a 'student' (user) profile: role is never read from signup data.
-- Self-signup metadata is user-controlled, so each value is validated here:
--   user_type        → only a known enum value, otherwise null
--   intended college → only an existing department
--   intended program → only an existing program of that college
-- A self-registered user chose their own password, so they are never sent to
-- Change Password. Admin-provisioned accounts pass no user_type and keep the column
-- default (must_change_password = true), exactly as before.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_user_type public.user_type;
  v_dept      uuid;
  v_program   uuid;
begin
  if meta ->> 'user_type' in ('freshman', 'visitor') then
    v_user_type := (meta ->> 'user_type')::public.user_type;
  end if;

  if coalesce(meta ->> 'intended_department_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select d.id into v_dept from public.departments d where d.id = (meta ->> 'intended_department_id')::uuid;
  end if;

  if v_dept is not null
     and coalesce(meta ->> 'intended_program_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select p.id into v_program from public.programs p
    where p.id = (meta ->> 'intended_program_id')::uuid and p.department_id = v_dept;
  end if;

  if v_user_type is null then
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, nullif(left(trim(meta ->> 'full_name'), 120), ''));
  else
    insert into public.profiles (id, email, full_name, user_type, intended_department_id, intended_program_id, must_change_password)
    values (new.id, new.email, nullif(left(trim(meta ->> 'full_name'), 120), ''), v_user_type, v_dept, v_program, false);
  end if;
  return new;
end;
$$;

-- Users may edit their own name, user type and intended college/program (RLS limits
-- updates to their own row). Never role, email, or the password flag.
grant update (full_name, user_type, intended_department_id, intended_program_id)
  on public.profiles to authenticated;

-- Admin → Users can edit the same fields with the service role.
grant update (user_type, intended_department_id, intended_program_id)
  on public.profiles to service_role;
