-- Admin › Departments: gallery fields on the existing departments and programs tables.
-- departments.code is the department's short name; programs stay the single list used by
-- sign-up, profiles and Campus Agent. No profile, event or announcement rows change here.

alter table public.departments
  add column description     text,
  add column logo_url        text,   -- public URL in the public-assets bucket (departments/…)
  add column cover_image_url text,   -- public URL in the public-assets bucket (departments/…)
  add column sort_order      integer,
  add column is_published    boolean not null default true;

-- Gallery order starts as the current code order.
with ordered as (select id, row_number() over (order by code) as position from public.departments)
update public.departments d set sort_order = o.position from ordered o where o.id = d.id;

alter table public.programs add column sort_order integer;

with ordered as (select id, row_number() over (partition by department_id order by name) as position from public.programs)
update public.programs p set sort_order = o.position from ordered o where o.id = p.id;

create index departments_sort_order_idx on public.departments (sort_order);

-- A department's programs go with it. The admin app refuses to delete a department while
-- a profile references it or one of its programs, so no profile link is cleared.
alter table public.programs
  drop constraint programs_department_id_fkey,
  add constraint programs_department_id_fkey foreign key (department_id) references public.departments (id) on delete cascade;
