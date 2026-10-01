-- Campus Agent MVP seed: WUP colleges and academic programs (A.Y. 2026–2027).
-- Source: "Student Handbook — Key Information" (Information-WUP.pdf), section
-- "Colleges, Academic Programs, and Annual College Events".
-- Program names are as listed there; where only an abbreviation is given
-- (BSMM, BSREM, BSAIM) the abbreviation is used. CCJE, COED and CON list no
-- programs, so students of those colleges skip the program field in onboarding.
-- Idempotent: safe to run more than once.

insert into public.departments (code, name) values
  ('CAS',  'College of Arts and Sciences'),
  ('CAMS', 'College of Allied Medical Sciences'),
  ('CBA',  'College of Business and Accountancy'),
  ('CCJE', 'College of Criminal Justice Education'),
  ('CECT', 'College of Engineering and Computer Technology'),
  ('CHTM', 'College of Hospitality and Tourism Management'),
  ('COED', 'College of Education'),
  ('CON',  'College of Nursing')
on conflict (code) do update set name = excluded.name;

insert into public.programs (department_id, code, name)
select d.id, p.code, p.name
from (values
  ('CAS',  'BA Communication',          'Bachelor of Arts in Communication'),
  ('CAS',  'BA Political Science',      'Bachelor of Arts in Political Science'),
  ('CAS',  'BS Psychology',             'Bachelor of Science in Psychology'),
  ('CAS',  'BS Social Work',            'Bachelor of Science in Social Work'),
  ('CAMS', 'BS Medical Technology',     'Bachelor of Science in Medical Technology'),
  ('CAMS', 'BS Pharmacy',               'Bachelor of Science in Pharmacy'),
  ('CAMS', 'BS Physical Therapy',       'Bachelor of Science in Physical Therapy'),
  ('CAMS', 'BS Radiologic Technology',  'Bachelor of Science in Radiologic Technology'),
  ('CBA',  'BSA',                       'Bachelor of Science in Accountancy'),
  ('CBA',  'BSMM',                      'BSMM'),
  ('CBA',  'BSBA',                      'Bachelor of Science in Business Administration'),
  ('CBA',  'BSREM',                     'BSREM'),
  ('CBA',  'BSAIM',                     'BSAIM'),
  ('CECT', 'BSIT',                      'Bachelor of Science in Information Technology'),
  ('CECT', 'BSCPE',                     'Bachelor of Science in Computer Engineering'),
  ('CECT', 'BSECE',                     'Bachelor of Science in Electronics and Communications Engineering'),
  ('CHTM', 'BSTM',                      'Bachelor of Science in Tourism Management'),
  ('CHTM', 'BSHM',                      'Bachelor of Science in Hospitality Management'),
  ('CHTM', 'BSND',                      'Bachelor of Science in Nutrition and Dietetics')
) as p(department_code, code, name)
join public.departments d on d.code = p.department_code
on conflict (code) do update set name = excluded.name, department_id = excluded.department_id;
