-- 009_room_access.sql  —  Rooms are visible only to people who entered the room's ID and key.
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".
--
-- BEFORE YOU RUN IT: set the key for General Chat on the line marked  <<< SET THIS.
-- Do this in the SQL Editor only. Do not save your real key into the project files,
-- because the project is public on GitHub.
--
-- What changes:
--   * General Chat becomes a normal room with its own key. Nobody gets in without it.
--   * The room list shows a person only the rooms they have joined with the key.
--   * Room keys can no longer be read from the database by users.
--   * Nobody can add themselves to a room without the key.
--   * Users can no longer delete other people's messages directly.
--   * Live traffic (typing, calls, instant delivery) is limited to room members.
--   * Everyone has to enter the key again once (memberships are reset), because
--     until now keys were readable and memberships could be self-added.
--
-- If anything fails, nothing is changed (it all runs as one unit).

-- 1. General Chat gets a key ---------------------------------------------------------
do $$
declare
  v_general_key text := 'CHANGE-ME';   -- <<< SET THIS (4 to 64 characters)
begin
  if v_general_key = 'CHANGE-ME' or char_length(v_general_key) not between 4 and 64 then
    raise exception 'Set the General Chat key near the top of this file first (4 to 64 characters).';
  end if;
  insert into public.rooms (id, name, access_key, created_by)
  values ('general', 'General Chat', v_general_key, null)
  on conflict (id) do update set access_key = excluded.access_key;
end;
$$;

-- 2. Membership check used by all the rules below --------------------------------------
create or replace function public.is_room_member(p_room_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_room_id is not null and exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

-- 3. Rooms table: no direct access at all (keys stay on the server) ------------------
drop policy if exists "Authenticated users can read rooms"   on public.rooms;
drop policy if exists "Authenticated users can create rooms" on public.rooms;
drop policy if exists "Authenticated users can delete rooms" on public.rooms;
revoke all on public.rooms from anon, authenticated;

-- 4. Memberships: only the join function can add one ---------------------------------
drop policy if exists "Users can join rooms" on public.room_members;
revoke insert, update, delete, truncate on public.room_members from anon, authenticated;
delete from public.room_members;   -- everyone re-enters the key once

-- 5. Messages: members of the room only ----------------------------------------------
drop policy if exists "Signed-in users can read messages" on public.messages;
create policy "Signed-in users can read messages"
  on public.messages for select
  to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "Users insert their own messages" on public.messages;
create policy "Users insert their own messages"
  on public.messages for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "Authenticated users can delete messages" on public.messages;
revoke update, delete, truncate on public.messages from anon, authenticated;

-- 6. Wrong-key attempts are counted on the server ------------------------------------
create table if not exists public.room_join_attempts (
  user_id uuid        not null,
  room_id text        not null,
  at      timestamptz not null default now()
);
create index if not exists room_join_attempts_user_at_idx
  on public.room_join_attempts (user_id, at);
alter table public.room_join_attempts enable row level security;
revoke all on public.room_join_attempts from anon, authenticated;

-- 7. Functions (the only way to touch rooms) -----------------------------------------
drop function if exists public.join_room(text, text);
drop function if exists public.create_room(text, text, text);
drop function if exists public.delete_room(text, text);
drop function if exists public.clear_room_messages(text, text);
drop function if exists public.my_rooms();

-- Join with ID + key. The same answer is given for "no such room" and "wrong key",
-- so room IDs cannot be discovered by guessing.
create function public.join_room(p_room_id text, p_access_key text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_room  public.rooms;
  v_fails integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select count(*) into v_fails
    from public.room_join_attempts
   where user_id = auth.uid() and at > now() - interval '10 minutes';
  if v_fails >= 8 then
    return json_build_object('ok', false, 'error', 'Too many wrong attempts. Wait 10 minutes and try again.');
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found or p_access_key is null or v_room.access_key <> p_access_key then
    insert into public.room_join_attempts (user_id, room_id)
    values (auth.uid(), left(coalesce(p_room_id, ''), 40));
    return json_build_object('ok', false, 'error', 'Wrong room ID or key.');
  end if;

  insert into public.room_members (room_id, user_id)
  values (p_room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  delete from public.room_join_attempts where at < now() - interval '1 day';

  return json_build_object('ok', true, 'room_name', v_room.name);
end;
$$;

create function public.create_room(p_room_id text, p_room_name text, p_access_key text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if p_room_id is null or p_room_id !~ '^[a-z0-9_-]{1,40}$' then
    return json_build_object('ok', false, 'error', 'Room ID: lowercase letters, numbers, - and _ only (1-40 chars).');
  end if;
  if char_length(btrim(coalesce(p_room_name, ''))) not between 1 and 60 then
    return json_build_object('ok', false, 'error', 'Room name must be 1-60 characters.');
  end if;
  if char_length(coalesce(p_access_key, '')) not between 4 and 64 then
    return json_build_object('ok', false, 'error', 'Access key must be 4-64 characters.');
  end if;
  if exists (select 1 from public.rooms where id = p_room_id) then
    return json_build_object('ok', false, 'error', 'That room ID is not available. Choose another.');
  end if;

  insert into public.rooms (id, name, access_key, created_by)
  values (p_room_id, btrim(p_room_name), p_access_key, auth.uid());

  insert into public.room_members (room_id, user_id)
  values (p_room_id, auth.uid());

  return json_build_object('ok', true);
end;
$$;

-- Delete a room: the creator, or a member who also gives the correct key.
create function public.delete_room(p_room_id text, p_access_key text default '')
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if p_room_id = 'general' then
    return json_build_object('ok', false, 'error', 'General Chat cannot be deleted.');
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found
     or not (
       v_room.created_by is not distinct from auth.uid()
       or (public.is_room_member(p_room_id) and v_room.access_key = coalesce(p_access_key, ''))
     ) then
    return json_build_object('ok', false, 'error', 'You need to be in this room and give its key to delete it.');
  end if;

  delete from public.messages     where room_id = p_room_id;
  delete from public.room_members where room_id = p_room_id;
  delete from public.rooms        where id = p_room_id;
  return json_build_object('ok', true);
end;
$$;

-- Clear a room's messages: members of that room only.
create function public.clear_room_messages(p_room_id text, p_access_key text default '')
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if not public.is_room_member(p_room_id) then
    return json_build_object('ok', false, 'error', 'Only members of this room can clear it.');
  end if;
  delete from public.messages where room_id = p_room_id;
  get diagnostics v_count = row_count;
  return json_build_object('ok', true, 'count', v_count);
end;
$$;

-- The room list: only rooms this person has joined. Never returns keys.
create function public.my_rooms()
returns table (id text, name text, created_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select r.id, r.name, r.created_at
    from public.rooms r
    join public.room_members m on m.room_id = r.id
   where m.user_id = auth.uid()
   order by r.created_at desc;
$$;

revoke all on function public.is_room_member(text)            from public, anon;
revoke all on function public.join_room(text, text)           from public, anon;
revoke all on function public.create_room(text, text, text)   from public, anon;
revoke all on function public.delete_room(text, text)         from public, anon;
revoke all on function public.clear_room_messages(text, text) from public, anon;
revoke all on function public.my_rooms()                      from public, anon;
grant execute on function public.is_room_member(text)            to authenticated;
grant execute on function public.join_room(text, text)           to authenticated;
grant execute on function public.create_room(text, text, text)   to authenticated;
grant execute on function public.delete_room(text, text)         to authenticated;
grant execute on function public.clear_room_messages(text, text) to authenticated;
grant execute on function public.my_rooms()                      to authenticated;

-- 8. Live channels: only members of a room can listen or send on "room:<id>" -----------
-- (Typing, presence, calls and instant delivery use these channels.)
drop policy if exists "Room members can receive on room channels" on realtime.messages;
create policy "Room members can receive on room channels"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_room_member(substring((select realtime.topic()) from '^room:(.+)$'))
  );

drop policy if exists "Room members can send on room channels" on realtime.messages;
create policy "Room members can send on room channels"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_room_member(substring((select realtime.topic()) from '^room:(.+)$'))
  );

-- 9. Make the API notice the new functions --------------------------------------------
notify pgrst, 'reload schema';
