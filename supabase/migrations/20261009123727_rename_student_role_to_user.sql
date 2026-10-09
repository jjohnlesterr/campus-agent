-- Final authorization model: every account is either 'admin' or 'user'. The old internal
-- value 'student' (every non-admin account) is renamed in place: no rows are rewritten, the
-- profiles.role default follows the rename, and admin checks (private.is_admin(): role =
-- 'admin') are unchanged. Role is authorization only, never a user category.
alter type public.app_role rename value 'student' to 'user';
comment on type public.app_role is 'Authorization role only: admin or user. Not a user category.';
