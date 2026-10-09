-- Admin › Settings: global configuration only.
-- Branding: university and app logos (public URLs in the public-assets bucket, branding/…).
-- AI preferences: default reply language and whether answers show source references.
-- The deployment's university name and short name are filled in where still empty.
alter table public.system_settings
  add column university_logo_url text check (university_logo_url is null or (university_logo_url ~* '^https://[^\s]+$' and char_length(university_logo_url) <= 2000)),
  add column app_logo_url text check (app_logo_url is null or (app_logo_url ~* '^https://[^\s]+$' and char_length(app_logo_url) <= 2000)),
  add column response_language text not null default 'auto' check (response_language in ('auto', 'en', 'fil')),
  add column show_source_references boolean not null default true;

update public.system_settings
set university_name = coalesce(university_name, 'Wesleyan University-Philippines'),
    university_short_name = coalesce(university_short_name, 'WUP')
where id = true;
