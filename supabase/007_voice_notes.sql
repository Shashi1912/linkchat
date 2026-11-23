-- 007_voice_notes.sql
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".
-- Safe to run multiple times.
-- Enables native audio MIME types in chat-images storage and expands message content constraint for voice notes.

-- 1. Expand allowed MIME types in chat-images bucket to support audio files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/aac'])
on conflict (id) do update
  set allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/aac'
      ];

-- 2. Expand content length limit on messages to accommodate rich audio data/metadata
alter table public.messages drop constraint if exists messages_content_ok;
alter table public.messages add constraint messages_content_ok check (
  char_length(content) <= 500000
  and (image_path is not null or char_length(btrim(content)) >= 1)
);

-- 3. Update insert validation trigger to accept audio file paths
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  recent integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send messages.' using errcode = '42501';
  end if;

  new.user_id      := auth.uid();      -- ignore whatever the client sent
  new.created_at   := now();           -- server time only
  new.display_name := btrim(new.display_name);

  -- A photo/audio attachment must be uploaded into the user's own folder
  if new.image_path is not null
     and new.image_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|webm|mp4|ogg|wav|mp3|m4a)$') then
    raise exception 'Invalid attachment.' using errcode = '42501';
  end if;

  select count(*) into recent
    from public.messages
   where user_id = new.user_id
     and created_at > now() - interval '10 seconds';

  if recent >= 5 then
    raise exception 'You are sending messages too fast. Wait a few seconds.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

notify pgrst, 'reload schema';
