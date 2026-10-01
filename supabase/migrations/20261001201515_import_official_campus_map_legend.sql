-- Official WU-P campus map legend (source: the "Campus Map" source uploaded in
-- Admin → Sources, map.jpg). One row per numbered building, plus one row per
-- office/college/facility the legend lists inside it, with its floor (L1–L4)
-- when the legend gives one. Transcribed as printed; nothing added.
-- A row whose name equals its building_name is the building itself.
-- Aliases are limited to clear, common short forms.

insert into public.campus_locations (building_number, name, building_name, floor, aliases, description)
select v.n, v.name, v.building, v.floor, v.aliases, 'From the official campus map legend.'
from (values
  (1,  'Gloria D. Lacson Building', 'Gloria D. Lacson Building', null, '{}'::text[]),
  (1,  'Accounting Office', 'Gloria D. Lacson Building', 'L1', '{}'),
  (1,  'Treasurer''s Office', 'Gloria D. Lacson Building', 'L1', '{}'),
  (1,  'Registrar', 'Gloria D. Lacson Building', 'L1', '{}'),
  (1,  'Office of the President', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Office of the Vice President for Finance', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Office of the Vice President for Administration & Planning', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Office of the Vice President for Academic Affairs', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Business & Procurement Office', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Gender & Development Office', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Human Resource Development Office', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Internal Auditor''s Office', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Office of Instruction', 'Gloria D. Lacson Building', 'L2', '{}'),
  (1,  'Asset Management Unit', 'Gloria D. Lacson Building', 'L3', '{}'),
  (1,  'ICT Office', 'Gloria D. Lacson Building', 'L3', '{}'),
  (1,  'Printing Office', 'Gloria D. Lacson Building', 'L3', '{}'),
  (1,  'Quality Assurance Office', 'Gloria D. Lacson Building', 'L3', '{}'),
  (1,  'College of Criminal Justice Education', 'Gloria D. Lacson Building', 'L4', '{}'),
  (2,  'University Gymnasium', 'University Gymnasium', null, '{gym}'),
  (3,  'Cultural Affairs & Sports Development Office', 'Cultural Affairs & Sports Development Office', null, '{}'),
  (4,  'Fitness Center', 'Fitness Center', null, '{}'),
  (5,  'Rev. Carlos K. Manacop (Academic) Building', 'Rev. Carlos K. Manacop (Academic) Building', null, '{}'),
  (5,  'College of Arts & Sciences', 'Rev. Carlos K. Manacop (Academic) Building', 'L1', '{}'),
  (5,  'College of Business & Accountancy', 'Rev. Carlos K. Manacop (Academic) Building', 'L2', '{}'),
  (6,  'Eze Building', 'Eze Building', null, '{}'),
  (6,  'College of Education', 'Eze Building', 'L2', '{}'),
  (7,  'Roxy Lefforge Complex', 'Roxy Lefforge Complex', null, '{}'),
  (7,  'Dr. Jorge Bocobo Hall (Left Wing)', 'Roxy Lefforge Complex', null, '{}'),
  (7,  'High School Department', 'Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex', 'L1', '{}'),
  (7,  'Wesley Divinity School', 'Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex', 'L1', '{}'),
  (7,  'Wesley Divinity School Library', 'Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex', 'L1', '{}'),
  (7,  'Graduate School', 'Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex', 'L2', '{}'),
  (7,  'Graduate School Library', 'Dr. Jorge Bocobo Hall (Left Wing), Roxy Lefforge Complex', 'L2', '{}'),
  (7,  'Dr. Gumersindo Garcia Hall (Right Wing)', 'Roxy Lefforge Complex', null, '{}'),
  (7,  'College of Medicine', 'Dr. Gumersindo Garcia Hall (Right Wing), Roxy Lefforge Complex', 'L1', '{}'),
  (7,  'College of Medicine Library', 'Dr. Gumersindo Garcia Hall (Right Wing), Roxy Lefforge Complex', 'L1', '{}'),
  (7,  'Chaplain''s Office', 'Dr. Gumersindo Garcia Hall (Right Wing), Roxy Lefforge Complex', 'L1', '{}'),
  (8,  'University Power House', 'University Power House', null, '{}'),
  (9,  'WU-P Food Court & Alumni Affairs Office', 'WU-P Food Court & Alumni Affairs Office', null, '{}'),
  (9,  'Commissary', 'WU-P Food Court & Alumni Affairs Office', null, '{}'),
  (10, 'Sewage Treatment Facility', 'Sewage Treatment Facility', null, '{}'),
  (11, 'Material Recovery Facility', 'Material Recovery Facility', null, '{}'),
  (12, 'WU-P Hospital', 'WU-P Hospital', null, '{}'),
  (13, 'Hospital Power House', 'Hospital Power House', null, '{}'),
  (14, 'Jose Valencia Building', 'Jose Valencia Building', null, '{}'),
  (14, 'College of Hospitality & Tourism Management', 'Jose Valencia Building', 'L2', '{}'),
  (14, 'John Wesley School of Law & Governance', 'Jose Valencia Building', 'L3', '{}'),
  (14, 'John Wesley School of Law & Governance Library', 'Jose Valencia Building', 'L3', '{}'),
  (15, 'Guest House', 'Guest House', null, '{}'),
  (16, 'Asuncion Perez Building', 'Asuncion Perez Building', null, '{}'),
  (16, 'College of Nursing', 'Asuncion Perez Building', null, '{}'),
  (17, 'JJDG Auditorium & Main Library Building', 'JJDG Auditorium & Main Library Building', null, '{}'),
  (17, 'JJDG Auditorium', 'JJDG Auditorium & Main Library Building', 'L1', '{}'),
  (17, 'WUPFSA', 'JJDG Auditorium & Main Library Building', 'L1', '{}'),
  (17, 'Research, Development & Productivity Office', 'JJDG Auditorium & Main Library Building', 'L2', '{}'),
  (17, 'Public Information Office', 'JJDG Auditorium & Main Library Building', 'L2', '{}'),
  (17, 'Archives & Museum', 'JJDG Auditorium & Main Library Building', 'L2', '{}'),
  (17, 'Audiovisual & Multimedia Center', 'JJDG Auditorium & Main Library Building', 'L2', '{}'),
  (17, 'Main Library', 'JJDG Auditorium & Main Library Building', 'L3', '{library,"university library"}'),
  (18, 'Bishop Paul Locke Granadosin Building', 'Bishop Paul Locke Granadosin Building', null, '{}'),
  (18, 'College of Engineering & Computer Technology', 'Bishop Paul Locke Granadosin Building', null, '{}'),
  (19, 'Security Office', 'Security Office', null, '{}'),
  (20, 'Bishop Dionisio Alejandro (COMSCI) Building', 'Bishop Dionisio Alejandro (COMSCI) Building', null, '{}'),
  (20, 'University Clinic', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L1', '{clinic}'),
  (20, 'Office of Student Affairs', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L1', '{}'),
  (20, 'Wesleyan Community Outreach Program', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L1', '{}'),
  (20, 'University Guidance & Placement Office', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L1', '{}'),
  (20, 'ID Printing', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L2', '{}'),
  (20, 'College of Allied Medical Sciences', 'Bishop Dionisio Alejandro (COMSCI) Building', 'L3', '{}'),
  (21, 'Wesley Divinity School Dormitory', 'Wesley Divinity School Dormitory', null, '{}'),
  (22, 'General Services Office Building', 'General Services Office Building', null, '{}'),
  (23, 'Elementary Building Annex', 'Elementary Building Annex', null, '{}'),
  (24, 'Elementary Open Court', 'Elementary Open Court', null, '{}'),
  (25, 'Patrocinio Ocampo (Elem. & Prep.) Building', 'Patrocinio Ocampo (Elem. & Prep.) Building', null, '{}'),
  (25, 'CCD Library', 'Patrocinio Ocampo (Elem. & Prep.) Building', 'L1', '{}'),
  (26, 'Job Skills Building', 'Job Skills Building', null, '{}'),
  (27, 'Share Building', 'Share Building', null, '{}'),
  (27, 'Elementary Library', 'Share Building', 'L1', '{}'),
  (28, 'Highschool Building', 'Highschool Building', null, '{}'),
  (28, 'High School Library', 'Highschool Building', 'L2', '{}'),
  (29, 'John Wesley Park', 'John Wesley Park', null, '{}'),
  (30, 'Volleyball Court', 'Volleyball Court', null, '{}'),
  (31, 'Basketball Court', 'Basketball Court', null, '{}'),
  (32, 'WU-P Parade Ground / Plaza Acacia', 'WU-P Parade Ground / Plaza Acacia', null, '{}'),
  (33, 'University Chapel', 'University Chapel', null, '{}'),
  (34, 'Old President''s House', 'Old President''s House', null, '{}'),
  (35, 'New President''s House', 'New President''s House', null, '{}')
) as v(n, name, building, floor, aliases)
on conflict (building_number, name) where building_number is not null do nothing;

-- Point the existing office records whose names clearly match the legend at their
-- official building (the office pages show the location's name). Offices with no
-- clear match keep their current location.
update public.offices o
set campus_location_id = l.id
from (values
  ('Office of the Registrar', 'Gloria D. Lacson Building'),
  ('Accounting Office', 'Gloria D. Lacson Building'),
  ('Office of Student Affairs', 'Bishop Dionisio Alejandro (COMSCI) Building'),
  ('University Library', 'JJDG Auditorium & Main Library Building')
) as m(office_name, building)
join public.campus_locations l on l.name = m.building and l.building_name = m.building and l.building_number is not null
where o.name = m.office_name;
