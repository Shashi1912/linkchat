-- 004_fix_realtime_and_rooms.sql
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".

-- 1. Index on room_members for ultra-fast RLS evaluation in Realtime
create index if not exists room_members_user_room_idx
  on public.room_members (user_id, room_id);

-- 2. Overload join_room so named or positional params in any order never fail in PostgREST cache
create or replace function public.join_room(p_access_key text, p_room_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.join_room(p_room_id, p_access_key);
end;
$$;

-- 3. Grant execute
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.create_room(text, text, text) to authenticated;

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
