-- Fix: creating a trip returns 403 under RLS.
--
-- Two independent problems, both fixed here. Safe to run more than once.
--
-- 1) The after-insert trigger that makes the creator an 'owner' member writes
--    into trip_members. That write must bypass RLS, which only happens when the
--    trigger function is SECURITY DEFINER (owned by a privileged role). If an
--    earlier/edited apply left it without definer rights, the trigger's insert
--    is rejected and the whole `insert into trips` aborts with 403. Recreate it
--    explicitly as SECURITY DEFINER.
--
-- 2) `createTrip` inserts a trip and immediately reads it back
--    (INSERT ... RETURNING, via .select().single()). The RETURNING row is
--    filtered by the SELECT policy, but the owner's trip_members row is added
--    by an AFTER trigger that isn't visible yet at RETURNING time — so the read
--    comes back empty and the client treats the sync as failed (and retries).
--    Letting owners read their own trips directly (owner_id = auth.uid()) makes
--    the row visible immediately, independent of the membership row.

-- (1) owner-membership trigger, guaranteed SECURITY DEFINER.
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

-- (2) owners can always read their own trips (not only via membership).
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select using (owner_id = auth.uid() or public.is_trip_member(id));
