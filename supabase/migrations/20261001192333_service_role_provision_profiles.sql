-- Admin → Users: student accounts are provisioned server-side with the service role.
-- Supabase Auth creates the user (password stays in Auth only); the signup trigger
-- creates the profile; the server then fills in the provisioned details here.
-- This project has no default grants, so the service role needs them explicitly.
-- No password column exists or is granted — profiles only hold must_change_password.

grant select on public.profiles to service_role;
grant update (full_name, student_id, department_id, program_id, year_level, must_change_password)
  on public.profiles to service_role;

-- Used to validate the department → program pairing during provisioning.
grant select on public.departments, public.programs to service_role;
