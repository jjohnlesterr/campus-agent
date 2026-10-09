-- Admin › Departments: an optional link to the department's official Facebook page, shown
-- to users on the department page. A structured link only: never fetched, scraped or used
-- as Campus Agent knowledge.
alter table public.departments add column facebook_url text check (
  facebook_url is null or (facebook_url ~* '^https?://[^\s]+$' and char_length(facebook_url) <= 500)
);
comment on column public.departments.facebook_url is 'Optional link to the department''s official Facebook page. Entered by admins; never fetched or scraped.';
