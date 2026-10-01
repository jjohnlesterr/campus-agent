-- Campus Agent MVP schema, migration 3 of 4: events, announcements, conversations, settings.
-- Source: docs/schema-proposal.md (revision 2) §5.4–§5.8.

-- ---------- Tables ----------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  venue         text,
  department_id uuid references public.departments (id) on delete set null,   -- null = university-wide
  visibility    public.content_visibility not null default 'authenticated',
  status        public.event_status not null default 'draft',
  source        text,                                          -- e.g. 'Calendar of Activities 2026–2027'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  category      public.announcement_category not null default 'general',
  department_id uuid references public.departments (id) on delete set null,   -- null = university-wide
  visibility    public.content_visibility not null default 'authenticated',
  status        public.publish_status not null default 'draft',
  publish_at    timestamptz not null default now(),
  expires_at    timestamptz,
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (expires_at is null or expires_at > publish_at)
);

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()               -- bumped on each new message; orders Recent Conversations
);

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  role              public.message_role not null,
  content           text not null,
  response_metadata jsonb,                                     -- structured CampusAgentResponse + sources
  created_at        timestamptz not null default now()
);

create table public.system_settings (
  id                    boolean primary key default true check (id),   -- single row
  university_name       text,
  university_short_name text,
  assistant_name        text not null default 'Campus Agent',
  logo_path             text,                                           -- path in public-assets bucket
  primary_brand_color   text check (primary_brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone              text not null default 'Asia/Manila',
  updated_at            timestamptz not null default now()
);

insert into public.system_settings (id) values (true);

-- ---------- Indexes ----------
create index events_starts_at_idx                 on public.events (starts_at);
create index events_department_id_idx             on public.events (department_id);
create index announcements_publish_at_idx         on public.announcements (publish_at desc);
create index announcements_department_id_idx      on public.announcements (department_id);
create index conversations_user_id_updated_at_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_id_created_idx on public.messages (conversation_id, created_at);

-- ---------- Triggers ----------
do $$
declare
  t text;
begin
  foreach t in array array['events', 'announcements', 'conversations', 'system_settings'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- A new message moves its conversation to the top of Recent Conversations.
create function private.touch_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger touch_conversation after insert on public.messages
  for each row execute function private.touch_conversation();

-- ---------- Row Level Security ----------
do $$
declare
  t text;
begin
  foreach t in array array['events', 'announcements', 'conversations', 'messages', 'system_settings'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Simple admin CRUD on official content (spec §77)
  foreach t in array array['events', 'announcements', 'system_settings'] loop
    execute format('create policy "Admins can insert %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

create policy "Anyone can read system settings" on public.system_settings
  for select to anon, authenticated using (true);

-- Department never restricts access; it only personalizes ranking in feed queries.
create policy "Public reads public events" on public.events
  for select to anon using (status <> 'draft' and visibility = 'public');
create policy "Signed-in users read events" on public.events
  for select to authenticated using (status <> 'draft' or (select private.is_admin()));

create policy "Public reads public announcements" on public.announcements
  for select to anon using (status = 'published' and visibility = 'public');
create policy "Signed-in users read announcements" on public.announcements
  for select to authenticated using (status = 'published' or (select private.is_admin()));

-- Conversations and messages: owner only (spec §74–75)
create policy "Users read own conversations" on public.conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own conversations" on public.conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own conversations" on public.conversations
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete own conversations" on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Users read messages in own conversations" on public.messages
  for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id));
create policy "Users add messages to own conversations" on public.messages
  for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = messages.conversation_id));

-- ---------- Data API access (no default grants in this project; RLS still filters rows) ----------
grant select on public.events, public.announcements, public.system_settings to anon, authenticated;
grant insert, update, delete on public.events, public.announcements, public.system_settings
  to authenticated;                                            -- admin-only via RLS
grant select, insert, update, delete on public.conversations to authenticated;   -- owner-only via RLS
grant select, insert on public.messages to authenticated;                         -- messages are immutable
