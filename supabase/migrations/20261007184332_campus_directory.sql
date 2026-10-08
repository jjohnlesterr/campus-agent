-- Campus Map as a structured directory: buildings, the places inside them, and the map
-- legend. The uploaded map image stays a reference file (documents, type campus_map).
-- Additive: existing campus_locations rows are kept and linked to their building.

create table public.campus_buildings (
  id              uuid primary key default gen_random_uuid(),
  building_number integer not null unique check (building_number > 0),
  name            text not null check (char_length(trim(name)) between 2 and 200),
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger set_updated_at before update on public.campus_buildings for each row execute function private.set_updated_at();

create table public.campus_map_legend (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (char_length(trim(code)) between 1 and 10),
  label       text not null check (char_length(trim(label)) between 2 and 120),
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on public.campus_map_legend for each row execute function private.set_updated_at();

alter table public.campus_locations
  add column building_id   uuid references public.campus_buildings (id) on delete set null,
  add column area          text,
  add column location_type text not null default 'place' check (location_type in ('building', 'area', 'place')),
  add column is_active     boolean not null default true;
create index campus_locations_building_id_idx on public.campus_locations (building_id);

comment on column public.campus_locations.building_number is 'Legacy: use building_id → campus_buildings.building_number.';
comment on column public.campus_locations.building_name is 'Legacy: use building_id → campus_buildings.name (and area for wings).';
comment on column public.campus_locations.area is 'Wing or hall inside a building, e.g. "Dr. Jorge Bocobo Hall (Left Wing)".';
comment on column public.campus_locations.location_type is 'building = the building itself (kept for office links); area = a wing/hall; place = an office, college, library or facility inside.';

-- Buildings from the official legend rows (the row whose name is the building's name).
insert into public.campus_buildings (building_number, name)
select distinct on (building_number) building_number, building_name
from public.campus_locations
where building_number is not null and name = building_name
order by building_number, created_at;

update public.campus_locations l set building_id = b.id
from public.campus_buildings b where b.building_number = l.building_number;

update public.campus_locations set location_type = 'building'
where building_number is not null and name = building_name;

-- Roxy Lefforge Complex (Building 7): its two halls are areas, and the places inside them keep the hall.
update public.campus_locations set location_type = 'area', area = name
where building_number = 7 and location_type <> 'building' and name like '%Hall (%Wing)';
update public.campus_locations set area = split_part(building_name, ', ', 1)
where building_number = 7 and location_type = 'place' and building_name like '%Hall (%Wing), %';

-- Names as in the admin-verified transcription; the earlier spelling stays searchable.
update public.campus_buildings set name = 'EZE Building' where building_number = 6 and name = 'Eze Building';
update public.campus_locations set name = 'EZE Building' where building_number = 6 and name = 'Eze Building';
update public.campus_buildings set name = 'JUDG Auditorium & Main Library Building' where building_number = 17 and name = 'JJDG Auditorium & Main Library Building';
update public.campus_locations
   set aliases = array_append(aliases, lower(name)), name = replace(name, 'JJDG', 'JUDG')
 where building_number = 17 and name like 'JJDG%';

-- Leftover sample rows without a building: hidden from the directory and answers, not deleted
-- (one is still linked to an office).
update public.campus_locations set is_active = false where building_number is null;

insert into public.campus_map_legend (code, label, description, sort_order) values
  ('A',   'ATM',                             null, 1),
  ('G',   'Gates',                           null, 2),
  ('S',   'Security',                        null, 3),
  ('P',   'Parking Area',                    null, 4),
  ('AA',  'Assembly Area',                   null, 5),
  ('CR',  'Comfort Room',                    null, 6),
  ('+',   'Health Service',                  null, 7),
  ('FC',  'Canteen/Food Court',              null, 8),
  ('CMC', 'Crisis Management Command Center', null, 9);

alter table public.campus_buildings enable row level security;
alter table public.campus_map_legend enable row level security;

create policy "Anyone can read campus buildings" on public.campus_buildings for select to anon, authenticated using (true);
create policy "Admins can insert campus_buildings" on public.campus_buildings for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update campus_buildings" on public.campus_buildings for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete campus_buildings" on public.campus_buildings for delete to authenticated using ((select private.is_admin()));

create policy "Anyone can read the map legend" on public.campus_map_legend for select to anon, authenticated using (true);
create policy "Admins can insert campus_map_legend" on public.campus_map_legend for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update campus_map_legend" on public.campus_map_legend for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete campus_map_legend" on public.campus_map_legend for delete to authenticated using ((select private.is_admin()));

grant select on public.campus_buildings, public.campus_map_legend to anon, authenticated;
grant insert, update, delete on public.campus_buildings, public.campus_map_legend to authenticated;
grant all on public.campus_buildings, public.campus_map_legend to service_role;
