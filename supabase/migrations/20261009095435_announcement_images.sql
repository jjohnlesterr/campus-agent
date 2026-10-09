-- Admin › Announcements: an optional image from the official announcement, uploaded by an
-- admin to the public-assets bucket under announcements/. Nothing is fetched or scraped.
alter table public.announcements add column image_url text check (
  image_url is null or (image_url ~* '^https://[^\s]+$' and char_length(image_url) <= 2000)
);
comment on column public.announcements.image_url is 'Optional image from the official announcement: public URL in the public-assets bucket (announcements/…). Uploaded by admins; never scraped.';
