-- "Where is the hospital?" means WU-P Hospital (Building 12), the only hospital on the
-- campus map — not Hospital Power House (Building 13).
update public.campus_locations
set aliases = array_append(aliases, 'hospital')
where building_number = 12 and name = 'WU-P Hospital' and not ('hospital' = any(aliases));
