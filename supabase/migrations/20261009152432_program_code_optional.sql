-- Program codes are optional (Admin › Departments). Before, a program saved without a code
-- stored its name as the code; from now on it stores null. Schema only: no existing rows are
-- changed here. The unique constraint on code still applies to codes that are set.
alter table public.programs alter column code drop not null;
comment on column public.programs.code is 'Optional program code (e.g. BSIT). Null when the program has none; never derived from the name. Unique when set.';
