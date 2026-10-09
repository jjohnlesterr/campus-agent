-- Admin › Announcements: manual order (drag and drop in the admin list). Admin-only; the
-- student page keeps its date order. Existing rows start in their newest-first order.
-- New announcements are placed above the current first one. publish_at never changes.
alter table public.announcements add column sort_order integer;

with ordered as (
  select id, row_number() over (order by publish_at desc, created_at desc) as position from public.announcements
)
update public.announcements a set sort_order = o.position from ordered o where o.id = a.id;

create index announcements_sort_order_idx on public.announcements (sort_order);
