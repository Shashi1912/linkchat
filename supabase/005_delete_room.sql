-- 005_delete_room.sql
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".
-- Allows room creators or members with the access key to delete a room and its messages.

create or replace function public.delete_room(p_room_id text, p_access_key text default '')
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

  if p_room_id = 'general' then
    return json_build_object('ok', false, 'error', 'General Chat cannot be deleted.');
  end if;

  select * into v_room from public.rooms where id = p_room_id;

  if v_room is null then
    return json_build_object('ok', false, 'error', 'Room not found.');
  end if;

  -- Allow deletion if user is creator OR provided the correct access key
  if v_room.created_by <> auth.uid() and (p_access_key is null or v_room.access_key <> p_access_key) then
    return json_build_object('ok', false, 'error', 'Incorrect access key. You need the room key to delete it.');
  end if;

  -- 1. Delete messages in this room
  delete from public.messages where room_id = p_room_id;

  -- 2. Delete room members
  delete from public.room_members where room_id = p_room_id;

  -- 3. Delete room
  delete from public.rooms where id = p_room_id;

  return json_build_object('ok', true);
end;
$$;

-- Overload for positional parameter order
create or replace function public.delete_room(p_access_key text, p_room_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.delete_room(p_room_id, p_access_key);
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.delete_room(text, text) to authenticated;
grant delete on public.rooms to authenticated;
grant delete on public.messages to authenticated;
grant delete on public.room_members to authenticated;

drop policy if exists "Authenticated users can delete rooms" on public.rooms;
create policy "Authenticated users can delete rooms"
  on public.rooms for delete
  to authenticated
  using (created_by = auth.uid());

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
