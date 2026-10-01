-- Campus Agent SAMPLE data for testing the MVP (not official university information).
-- Events/announcements are tagged source = 'Sample data'; offices/locations carry a
-- "Sample data" description. Re-runnable: replaces the previous sample rows.
-- Requires supabase/seed.sql (departments) first.

-- Campus locations
insert into public.campus_locations (name, description)
select v.name, 'Sample data — replace with official campus map details.'
from (values
  ('Administration Building, Ground Floor'),
  ('Student Center, 2nd Floor'),
  ('Library Building')
) as v(name)
where not exists (select 1 from public.campus_locations l where l.name = v.name);

-- Offices
insert into public.offices (name, head_name, office_hours, description, campus_location_id)
select v.name, 'To be confirmed', v.hours, 'Sample data — replace with official office details.',
       (select id from public.campus_locations where name = v.location limit 1)
from (values
  ('Office of the Registrar',          'Mon–Fri, 8:00 AM – 5:00 PM', 'Administration Building, Ground Floor'),
  ('Accounting Office',                'Mon–Fri, 8:00 AM – 5:00 PM', 'Administration Building, Ground Floor'),
  ('Office of Student Affairs',        'Mon–Fri, 8:00 AM – 5:00 PM', 'Student Center, 2nd Floor'),
  ('Guidance and Counseling Office',   'Mon–Fri, 8:00 AM – 5:00 PM', 'Student Center, 2nd Floor'),
  ('University Library',               'Mon–Sat, 7:30 AM – 7:00 PM', 'Library Building')
) as v(name, hours, location)
on conflict (name) do nothing;

-- Events (times are Asia/Manila)
delete from public.events where source = 'Sample data';
insert into public.events (title, description, starts_at, all_day, venue, department_id, status, source)
select v.title, v.description,
       ((current_date + v.days_from_today)::timestamp + v.local_time) at time zone 'Asia/Manila',
       v.all_day, v.venue,
       (select id from public.departments where code = v.dept),
       'published', 'Sample data'
from (values
  ('Foundation Week Opening Program', 'Opening ceremony and parade for Foundation Week.', 7,  time '08:00', false, 'University Gymnasium', null),
  ('CECT IT Week: Hackathon Day', 'Team coding challenge for Engineering and Computer Technology students.', 10, time '09:00', false, 'Computer Laboratory Building', 'CECT'),
  ('Nursing Capping and Pinning Ceremony', 'Ceremony for nursing students entering clinical duty.', 14, time '14:00', false, 'University Auditorium', 'CON'),
  ('Midterm Examinations', 'Midterm examination week for all programs.', 21, time '00:00', true, null, null)
) as v(title, description, days_from_today, local_time, all_day, venue, dept);

-- Announcements
delete from public.announcements where source = 'Sample data';
insert into public.announcements (title, content, publish_at, department_id, status, source)
select v.title, v.content,
       (current_date - v.days_ago)::timestamp at time zone 'Asia/Manila',
       (select id from public.departments where code = v.dept),
       'published', 'Sample data'
from (values
  ('Second semester enrollment schedule', 'Enrollment for the second semester opens next month. Check with the Office of the Registrar for your college''s schedule.', 1, null),
  ('Computer laboratory schedule update', 'Computer laboratories will close at 6:00 PM during IT Week preparations.', 2, 'CECT'),
  ('Scholarship application reminder', 'Applications for academic scholarships are accepted at the Office of Student Affairs until the end of the month.', 3, null),
  ('Clinical duty orientation', 'All third-year nursing students must attend the clinical duty orientation.', 1, 'CON')
) as v(title, content, days_ago, dept);
