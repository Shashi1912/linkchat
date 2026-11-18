-- LinkChat database setup.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then click "Run".
-- Safe to run more than once.

-- 1. Messages table ---------------------------------------------------------
create table if not exists public.messages (
  id           uuid        primary key default gen_random_uuid(),
  room_id      text        not null default 'general'
                           check (room_id ~ '^[a-z0-9_-]{1,40}$'),
  user_id      uuid        not null default auth.uid()
                           references auth.users (id) on delete cascade,
  display_name text        not null
                           check (char_length(btrim(display_name)) between 2 and 30),
  content      text        not null default '',
  image_path   text,       -- file inside the "chat-images" storage bucket, or null
  created_at   timestamptz not null default now(),
  -- text up to 1000 chars; a message needs text, a photo, or both
  constraint messages_content_ok check (
    char_length(content) <= 1000
    and (image_path is not null or char_length(btrim(content)) >= 1)
  )
);

-- Fast "latest 50 messages in this room" and "load earlier" queries.
create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

-- Fast rate-limit lookups per user.
create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

-- 2. Row Level Security -----------------------------------------------------
alter table public.messages enable row level security;

-- Signed-in users (including anonymous ones) can read messages.
drop policy if exists "Signed-in users can read messages" on public.messages;
create policy "Signed-in users can read messages"
  on public.messages for select
  to authenticated
  using (true);

-- Signed-in users can only insert messages as themselves.
drop policy if exists "Users insert their own messages" on public.messages;
create policy "Users insert their own messages"
  on public.messages for insert
  to authenticated
  with check (user_id = auth.uid());

-- No UPDATE or DELETE policies exist, so nobody can edit or delete messages
-- from the website. Logged-out (anon) requests get nothing at all.
revoke all on public.messages from anon;
revoke update, delete, truncate on public.messages from authenticated;

-- 3. Server-side rules on every insert --------------------------------------
-- The server, not the browser, decides who sent the message and when,
-- and it throttles spam: at most 5 messages per 10 seconds per user.
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

  -- A photo must be one the sender uploaded into their own folder.
  if new.image_path is not null
     and new.image_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$') then
    raise exception 'Invalid image.' using errcode = '42501';
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

-- 4. Photo storage ------------------------------------------------------------
-- A public bucket: anyone with a photo's link can view it (same as the room).
-- Max 5 MB per file, images only. The website shrinks photos to ~300 KB first.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Signed-in users may upload only into a folder named after their own user id.
-- There is no update/delete policy, so nobody can replace or delete photos.
drop policy if exists "Users upload chat images to own folder" on storage.objects;
create policy "Users upload chat images to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Turn on Realtime for this table ----------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
