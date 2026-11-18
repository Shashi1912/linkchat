-- Private rooms with access keys.
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".
-- Safe to run more than once.

-- 1. Rooms table ----------------------------------------------------------------
create table if not exists public.rooms (
  id           text        primary key
                           check (id ~ '^[a-z0-9_-]{1,40}$'),
  name         text        not null default 'Chat Room'
                           check (char_length(btrim(name)) between 1 and 60),
  access_key   text        not null
                           check (char_length(access_key) between 4 and 64),
  created_by   uuid        references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- RLS on rooms
alter table public.rooms enable row level security;

-- Anyone signed in can read rooms (they still need the access key to join in the app).
drop policy if exists "Authenticated users can read rooms" on public.rooms;
create policy "Authenticated users can read rooms"
  on public.rooms for select
  to authenticated
  using (true);

-- Signed-in users can create rooms.
drop policy if exists "Authenticated users can create rooms" on public.rooms;
create policy "Authenticated users can create rooms"
  on public.rooms for insert
  to authenticated
  with check (created_by = auth.uid());

-- No update/delete from the client.
revoke all on public.rooms from anon;
revoke update, delete, truncate on public.rooms from authenticated;
grant select, insert on public.rooms to authenticated;
grant usage on schema public to authenticated;

-- 2. Room members table (tracks who has unlocked which room) --------------------
create table if not exists public.room_members (
  room_id      text        not null references public.rooms (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_members enable row level security;

-- Users can see their own memberships.
drop policy if exists "Users can see own memberships" on public.room_members;
create policy "Users can see own memberships"
  on public.room_members for select
  to authenticated
  using (user_id = auth.uid());

-- Users can insert their own membership (after key validation via RPC).
drop policy if exists "Users can join rooms" on public.room_members;
create policy "Users can join rooms"
  on public.room_members for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on public.room_members from anon;
revoke update, delete, truncate on public.room_members from authenticated;
grant select, insert on public.room_members to authenticated;

-- 3. RPC: validate access key and join a room -----------------------------------
create or replace function public.join_room(p_room_id text, p_access_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id;

  if v_room is null then
    return json_build_object('ok', false, 'error', 'Room not found.');
  end if;

  if v_room.access_key <> p_access_key then
    return json_build_object('ok', false, 'error', 'Wrong access key.');
  end if;

  -- Upsert membership
  insert into public.room_members (room_id, user_id)
  values (p_room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return json_build_object('ok', true, 'room_name', v_room.name);
end;
$$;

-- 4. RPC: create a room --------------------------------------------------------
create or replace function public.create_room(p_room_id text, p_room_name text, p_access_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  -- Validate room_id format
  if p_room_id !~ '^[a-z0-9_-]{1,40}$' then
    return json_build_object('ok', false, 'error', 'Room ID: lowercase letters, numbers, - and _ only (1-40 chars).');
  end if;

  if char_length(btrim(p_room_name)) < 1 or char_length(btrim(p_room_name)) > 60 then
    return json_build_object('ok', false, 'error', 'Room name must be 1-60 characters.');
  end if;

  if char_length(p_access_key) < 4 or char_length(p_access_key) > 64 then
    return json_build_object('ok', false, 'error', 'Access key must be 4-64 characters.');
  end if;

  -- Check if room already exists
  if exists (select 1 from public.rooms where id = p_room_id) then
    return json_build_object('ok', false, 'error', 'A room with this ID already exists.');
  end if;

  insert into public.rooms (id, name, access_key, created_by)
  values (p_room_id, btrim(p_room_name), p_access_key, auth.uid());

  -- Auto-join the creator
  insert into public.room_members (room_id, user_id)
  values (p_room_id, auth.uid());

  return json_build_object('ok', true);
end;
$$;

-- 5. Update messages RLS: only room members can read/send in private rooms ------
-- Drop old policies and recreate with room membership check.
drop policy if exists "Signed-in users can read messages" on public.messages;
create policy "Signed-in users can read messages"
  on public.messages for select
  to authenticated
  using (
    room_id = 'general'
    or exists (
      select 1 from public.room_members
      where room_members.room_id = messages.room_id
        and room_members.user_id = auth.uid()
    )
  );

drop policy if exists "Users insert their own messages" on public.messages;
create policy "Users insert their own messages"
  on public.messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      room_id = 'general'
      or exists (
        select 1 from public.room_members
        where room_members.room_id = messages.room_id
          and room_members.user_id = auth.uid()
      )
    )
  );

-- 6. Realtime for rooms table ---------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end;
$$;
