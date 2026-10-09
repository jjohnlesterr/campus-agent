-- Admin › Departments: where a cover image sits inside its fixed crop window, as CSS
-- object-position percentages (50/50 = centered). The uploaded file is never changed.
alter table public.departments
  add column cover_position_x numeric(5, 2) not null default 50 check (cover_position_x between 0 and 100),
  add column cover_position_y numeric(5, 2) not null default 50 check (cover_position_y between 0 and 100);
