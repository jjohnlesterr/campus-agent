-- Public sign-up now asks only for full name, email and password.
--
-- No columns change: user_type, intended_department_id and intended_program_id stay
-- nullable with their existing data. The signup form now sends
-- `signup_source: 'self'` instead of a user type, so the trigger uses that (or a
-- user type, for older clients) to tell a self-registered user, who chose their own
-- password, from an admin-provisioned account, which keeps must_change_password = true.
--
-- signup_source is user-controlled metadata, but it only affects the new user's own
-- must_change_password flag. Role is still never read from signup data.
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

  if v_user_type is null and meta ->> 'signup_source' is distinct from 'self' then
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, nullif(left(trim(meta ->> 'full_name'), 120), ''));
  else
    insert into public.profiles (id, email, full_name, user_type, intended_department_id, intended_program_id, must_change_password)
    values (new.id, new.email, nullif(left(trim(meta ->> 'full_name'), 120), ''), v_user_type, v_dept, v_program, false);
  end if;
  return new;
end;
$$;
