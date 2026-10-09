-- Admin › Users: deactivating an account keeps it and its data. The Auth user is banned
-- (no sign-in or token refresh) and this timestamp marks the profile, so the app stops
-- treating an existing session as signed in. Users cannot change it: profiles grants
-- UPDATE to authenticated only on full_name, user_type and intended college/program.
alter table public.profiles add column deactivated_at timestamptz;
comment on column public.profiles.deactivated_at is 'Set when an admin deactivates the account (the Auth user is also banned). Null = active. Users cannot change it: no column grant.';
