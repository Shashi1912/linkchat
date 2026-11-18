-- 006_clear_messages.sql
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".
-- Allows users to clear room messages from the database.

create or replace function public.clear_room_messages(p_room_id text, p_access_key text default '')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  if p_room_id = 'general' then
    delete from public.messages where room_id = 'general';
    get diagnostics v_count = row_count;
    return json_build_object('ok', true, 'count', v_count);
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room is null then
    -- Room may not exist in rooms table or is ad-hoc, still clear its messages
    delete from public.messages where room_id = p_room_id;
    get diagnostics v_count = row_count;
    return json_build_object('ok', true, 'count', v_count);
  end if;

  -- Verify room key or creator or membership
  if v_room.created_by <> auth.uid() and (p_access_key is null or v_room.access_key <> p_access_key) then
    if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()) then
      return json_build_object('ok', false, 'error', 'Incorrect access key to clear room.');
    end if;
  end if;

  delete from public.messages where room_id = p_room_id;
  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'count', v_count);
end;
$$;

-- Positional argument overload
create or replace function public.clear_room_messages(p_access_key text, p_room_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.clear_room_messages(p_room_id, p_access_key);
end;
$$;

-- Grants & RLS policies
grant execute on function public.clear_room_messages(text, text) to authenticated;
grant delete on public.messages to authenticated;

drop policy if exists "Authenticated users can delete messages" on public.messages;
create policy "Authenticated users can delete messages"
  on public.messages for delete
  to authenticated
  using (true);

notify pgrst, 'reload schema';
