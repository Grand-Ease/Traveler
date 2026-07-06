-- GrandEase Traveler — initial Supabase schema
--
-- Data model mirrors src/types.ts. Times are stored as WALL-CLOCK text
-- (HH:mm) plus an IANA timezone string — NEVER as timestamptz — so an item's
-- "7pm dinner in Paris" always reads back as 19:00 regardless of the viewer's
-- device timezone. Dates are plain `date`.
--
-- Apply this file via the Supabase SQL editor or `supabase db push` /
-- `supabase migration up`.

-- Needed for gen_random_uuid() and the moddatetime trigger helper.
create extension if not exists pgcrypto;
create extension if not exists moddatetime;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  timezone    text,
  color       text,
  locations   jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips on delete cascade,
  type          text not null check (type in ('travel','lodging','dining','activity','note')),
  title         text not null,
  subtype       text,
  date          date not null,
  end_date      date,
  start_time    text,   -- wall-clock HH:mm (24h), destination-local
  end_time      text,   -- wall-clock HH:mm (24h), destination-local
  timezone      text,   -- IANA tz id for the wall-clock times above
  location      text,
  from_place    text,
  to_place      text,
  number        text,
  gate          text,
  nights        int,
  confirmation  text,
  phone         text,
  seats_or_room text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id    uuid not null references public.trips on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_invites (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips on delete cascade,
  email      text not null,
  role       text not null check (role in ('editor','viewer')),
  created_at timestamptz not null default now(),
  unique (trip_id, email)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists trips_owner_id_idx    on public.trips (owner_id);
create index if not exists items_trip_id_idx      on public.items (trip_id);
create index if not exists items_trip_date_idx    on public.items (trip_id, date);
create index if not exists trip_members_user_idx  on public.trip_members (user_id);
create index if not exists trip_invites_email_idx on public.trip_invites (lower(email));

-- ---------------------------------------------------------------------------
-- Triggers: updated_at maintenance + auto owner membership
-- ---------------------------------------------------------------------------

-- moddatetime keeps updated_at fresh on any UPDATE.
drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function moddatetime (updated_at);

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function moddatetime (updated_at);

-- On trip insert, add the creator as an 'owner' member automatically.
create or replace function public.tg_trips_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trips_add_owner_member on public.trips;
create trigger trips_add_owner_member
  after insert on public.trips
  for each row execute function public.tg_trips_add_owner_member();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.trips         enable row level security;
alter table public.items         enable row level security;
alter table public.trip_members  enable row level security;
alter table public.trip_invites  enable row level security;

-- SECURITY DEFINER helpers query trip_members by the caller's auth.uid().
-- They break the RLS recursion that would occur if policies queried
-- trip_members directly (which itself is protected by RLS).
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_trip(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid()
      and role in ('owner','editor')
  );
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- trips policies
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select using (public.is_trip_member(id));

drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
  for insert with check (owner_id = auth.uid());

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips
  for update using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));

drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips
  for delete using (public.is_trip_owner(id));

-- items policies
drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select using (public.is_trip_member(trip_id));

drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert with check (public.can_edit_trip(trip_id));

drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete using (public.can_edit_trip(trip_id));

-- trip_members policies: members can read the roster; only the owner manages it.
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members
  for select using (public.is_trip_member(trip_id));

drop policy if exists trip_members_manage on public.trip_members;
create policy trip_members_manage on public.trip_members
  for all using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- A member may remove THEIR OWN membership (leave / unsubscribe from a trip).
drop policy if exists trip_members_leave on public.trip_members;
create policy trip_members_leave on public.trip_members
  for delete using (user_id = auth.uid());

-- trip_invites policies: only the owner manages invites directly.
-- Invitee lookups happen via the claim_invites() RPC (SECURITY DEFINER).
drop policy if exists trip_invites_manage on public.trip_invites;
create policy trip_invites_manage on public.trip_invites
  for all using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- Invite by email. Owner-only.
-- If a user with that email already exists, add them straight to trip_members.
-- Otherwise store a pending invite that is claimed at their next login.
-- Returns { status: 'added' | 'invited' }.
create or replace function public.invite_member(p_trip uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'Only the trip owner can invite people.';
  end if;
  if p_role not in ('editor','viewer') then
    raise exception 'Role must be editor or viewer.';
  end if;

  select id into v_user from auth.users where lower(email) = v_email limit 1;

  if v_user is not null then
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip, v_user, p_role)
    on conflict (trip_id, user_id)
      do update set role = excluded.role;
    return jsonb_build_object('status', 'added');
  else
    insert into public.trip_invites (trip_id, email, role)
    values (p_trip, v_email, p_role)
    on conflict (trip_id, email)
      do update set role = excluded.role;
    return jsonb_build_object('status', 'invited');
  end if;
end;
$$;

-- Convert any pending invites for the caller's email into memberships.
-- Called (best-effort) right after sign-in.
create or replace function public.claim_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer := 0;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return 0;
  end if;

  with claimed as (
    delete from public.trip_invites i
    where lower(i.email) = v_email
    returning i.trip_id, i.role
  ), inserted as (
    insert into public.trip_members (trip_id, user_id, role)
    select c.trip_id, auth.uid(), c.role from claimed c
    on conflict (trip_id, user_id) do nothing
    returning 1
  )
  select count(*)::int into v_count from inserted;

  return v_count;
end;
$$;

-- Owner-only removal of a member (or pending downgrade). Cannot remove the owner.
create or replace function public.remove_member(p_trip uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'Only the trip owner can remove members.';
  end if;
  delete from public.trip_members
  where trip_id = p_trip and user_id = p_user and role <> 'owner';
end;
$$;

-- List members with their email + role. Members of the trip may call this;
-- the client cannot read auth.users directly.
create or replace function public.list_members(p_trip uuid)
returns table (user_id uuid, email text, role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_member(p_trip) then
    raise exception 'Not a member of this trip.';
  end if;
  return query
    select m.user_id, u.email::text, m.role
    from public.trip_members m
    join auth.users u on u.id = m.user_id
    where m.trip_id = p_trip
    order by (m.role = 'owner') desc, u.email;
end;
$$;

-- Allow authenticated users to call the RPCs.
grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.claim_invites() to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
