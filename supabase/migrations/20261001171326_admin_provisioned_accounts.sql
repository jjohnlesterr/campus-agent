-- Accounts are provisioned by an administrator; there is no public sign-up.
-- Passwords live only in Supabase Auth. Profiles hold a flag, never a password.

-- New accounts start with a temporary password and must change it on first login.
alter table public.profiles add column must_change_password boolean not null default true;
-- Existing accounts already chose their own passwords.
update public.profiles set must_change_password = false;

-- The flag clears only when the password actually changes in Supabase Auth.
create function private.handle_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set must_change_password = false where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function private.handle_password_change();

-- Profile details (name, student ID, college, program, year) are provisioned by
-- admins, so students can no longer edit them through the API.
revoke update (full_name, student_id, department_id, program_id, year_level, avatar_url, onboarded_at)
  on public.profiles from authenticated;
