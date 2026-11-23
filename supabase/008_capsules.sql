-- Time capsules and place messages.
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".
-- Safe to run more than once.
--
-- How it stays sealed: the sealed content is stored in tables that normal
-- users cannot read at all. The only way in is a function that checks the
-- rule on the server (the unlock time, or the distance to the place).
-- The chat message itself only holds the capsule's ID.

-- 1. Tables (no direct access for users) -----------------------------------------
create table if not exists public.capsules (
  id              uuid        primary key default gen_random_uuid(),
  room_id         text        not null check (room_id ~ '^[a-z0-9_-]{1,40}$'),
  sender_id       uuid        references auth.users (id) on delete set null,
  sender_name     text        not null check (char_length(btrim(sender_name)) between 2 and 30),
  kind            text        not null check (kind in ('time', 'place')),
  unlock_at       timestamptz,
  place_lat       double precision,
  place_lng       double precision,
  place_radius_m  integer     check (place_radius_m between 20 and 5000),
  place_label     text        check (char_length(place_label) <= 80),
  created_at      timestamptz not null default now(),
  check (
    (kind = 'time'  and unlock_at is not null)
    or
    (kind = 'place' and place_lat is not null and place_lng is not null and place_radius_m is not null)
  )
);

create table if not exists public.capsule_items (
  id          uuid    primary key default gen_random_uuid(),
  capsule_id  uuid    not null references public.capsules (id) on delete cascade,
  kind        text    not null check (kind in ('text', 'photo')),
  body        text    not null,   -- text (maybe encrypted by the app) or the photo's storage path
  position    integer not null default 0
);

alter table public.capsules      enable row level security;
alter table public.capsule_items enable row level security;
-- No policies on these two tables: ordinary users cannot read or write them directly.

-- 2. Helpers ---------------------------------------------------------------------
-- Distance in metres between two points on Earth.
create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Photo rule for storage: a capsule photo can be downloaded only after its time capsule opens.
create or replace function public.capsule_photo_unlocked(p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.capsule_items i
      join public.capsules c on c.id = i.capsule_id
     where i.kind = 'photo'
       and i.body = p_name
       and c.kind = 'time'
       and c.unlock_at <= now()
  );
$$;

-- 3. Create a capsule ------------------------------------------------------------
-- p_items: JSON array of {"kind":"text","body":"..."} or {"kind":"photo","body":"<user-id>/<file>.jpg"}
create or replace function public.seal_capsule(
  p_kind        text,
  p_room_id     text,
  p_sender_name text,
  p_unlock_at   timestamptz,
  p_lat         double precision,
  p_lng         double precision,
  p_radius      integer,
  p_place_label text,
  p_items       jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid := gen_random_uuid();
  item jsonb;
  pos integer := 0;
  n integer;
begin
  if uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if p_kind not in ('time', 'place') then
    raise exception 'Unknown capsule type.';
  end if;
  if char_length(btrim(coalesce(p_sender_name, ''))) < 2 then
    raise exception 'Name is too short.';
  end if;

  n := coalesce(jsonb_array_length(p_items), 0);
  if n < 1 or n > 10 then
    raise exception 'Add between 1 and 10 items.';
  end if;

  if p_kind = 'time' then
    if p_unlock_at is null or p_unlock_at < now() + interval '2 minutes' then
      raise exception 'Choose a time at least 2 minutes from now.';
    end if;
    if p_unlock_at > now() + interval '20 years' then
      raise exception 'Choose a date within 20 years.';
    end if;
  else
    if p_lat is null or p_lng is null
       or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'The place is not valid.';
    end if;
    if p_radius is null or p_radius not between 20 and 5000 then
      raise exception 'The radius must be between 20 m and 5 km.';
    end if;
    if n <> 1 or (p_items -> 0 ->> 'kind') <> 'text' then
      raise exception 'A place message holds one text only.';
    end if;
  end if;

  insert into public.capsules
    (id, room_id, sender_id, sender_name, kind, unlock_at,
     place_lat, place_lng, place_radius_m, place_label)
  values
    (cid, p_room_id, uid, btrim(p_sender_name), p_kind,
     case when p_kind = 'time' then p_unlock_at end,
     case when p_kind = 'place' then p_lat end,
     case when p_kind = 'place' then p_lng end,
     case when p_kind = 'place' then p_radius end,
     case when p_kind = 'place' then left(btrim(coalesce(p_place_label, '')), 80) end);

  for item in select * from jsonb_array_elements(p_items) loop
    pos := pos + 1;
    if item ->> 'kind' = 'text' then
      if char_length(coalesce(item ->> 'body', '')) not between 1 and 4000 then
        raise exception 'A text item is empty or too long.';
      end if;
    elsif item ->> 'kind' = 'photo' then
      if coalesce(item ->> 'body', '') !~ ('^' || uid::text || '/[0-9a-f-]{36}\.jpg$') then
        raise exception 'A photo is not valid.';
      end if;
    else
      raise exception 'Unknown item type.';
    end if;
    insert into public.capsule_items (capsule_id, kind, body, position)
    values (cid, item ->> 'kind', item ->> 'body', pos);
  end loop;

  return cid;
end;
$$;

-- 4. Public card (no coordinates, no content) -------------------------------------
create or replace function public.capsule_card(p_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'kind', c.kind,
    'sender_name', c.sender_name,
    'unlock_at', c.unlock_at,
    'place_label', c.place_label,
    'radius_m', c.place_radius_m,
    'items', (select count(*) from public.capsule_items i where i.capsule_id = c.id)
  )
  from public.capsules c
  where c.id = p_id
    and auth.uid() is not null;
$$;

-- 5. Open a time capsule (only after the unlock time) -----------------------------
create or replace function public.open_time_capsule(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  c public.capsules;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  select * into c from public.capsules where id = p_id;
  if not found or c.kind <> 'time' then
    raise exception 'Capsule not found.';
  end if;
  if now() < c.unlock_at then
    raise exception 'NOT_YET:%', c.unlock_at using errcode = 'P0002';
  end if;
  return (
    select jsonb_build_object('items', coalesce(
      jsonb_agg(jsonb_build_object('kind', i.kind, 'body', i.body) order by i.position),
      '[]'::jsonb))
      from public.capsule_items i
     where i.capsule_id = p_id
  );
end;
$$;

-- 6. Open a place message (only when the reader is close enough) ------------------
create or replace function public.open_place_message(p_id uuid, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  c public.capsules;
  d double precision;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Location is needed to open this message.';
  end if;
  select * into c from public.capsules where id = p_id;
  if not found or c.kind <> 'place' then
    raise exception 'Message not found.';
  end if;
  d := public.distance_m(p_lat, p_lng, c.place_lat, c.place_lng);
  if d > c.place_radius_m then
    raise exception 'TOO_FAR:%', round(d) using errcode = 'P0003';
  end if;
  return (
    select jsonb_build_object('items', coalesce(
      jsonb_agg(jsonb_build_object('kind', i.kind, 'body', i.body) order by i.position),
      '[]'::jsonb))
      from public.capsule_items i
     where i.capsule_id = p_id
  );
end;
$$;

-- 7. Permissions -----------------------------------------------------------------
revoke all on function public.seal_capsule(text, text, text, timestamptz, double precision, double precision, integer, text, jsonb) from public, anon;
revoke all on function public.capsule_card(uuid) from public, anon;
revoke all on function public.open_time_capsule(uuid) from public, anon;
revoke all on function public.open_place_message(uuid, double precision, double precision) from public, anon;
revoke all on function public.capsule_photo_unlocked(text) from public, anon;
grant execute on function public.seal_capsule(text, text, text, timestamptz, double precision, double precision, integer, text, jsonb) to authenticated;
grant execute on function public.capsule_card(uuid) to authenticated;
grant execute on function public.open_time_capsule(uuid) to authenticated;
grant execute on function public.open_place_message(uuid, double precision, double precision) to authenticated;
grant execute on function public.capsule_photo_unlocked(text) to authenticated;

-- 8. Private photo bucket for time capsules ---------------------------------------
-- Not public: a photo can only be downloaded after its capsule opens (rule below).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capsule-photos', 'capsule-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload capsule photos to own folder" on storage.objects;
create policy "Users upload capsule photos to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'capsule-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Capsule photos readable after unlock" on storage.objects;
create policy "Capsule photos readable after unlock"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'capsule-photos'
    and public.capsule_photo_unlocked(name)
  );
