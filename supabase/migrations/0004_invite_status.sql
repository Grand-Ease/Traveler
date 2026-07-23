-- Expose pending invitations alongside accepted members and track successful
-- email delivery attempts.

alter table public.trip_invites
  add column if not exists last_sent_at timestamptz;

create or replace function public.list_trip_shares(p_trip uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  role text,
  accepted boolean,
  invited_at timestamptz,
  last_sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_member(p_trip) then
    raise exception 'Not a member of this trip.';
  end if;

  return query
    select shares.*
    from (
      select
        m.user_id as id,
        m.user_id,
        u.email::text,
        m.role,
        true as accepted,
        m.created_at as invited_at,
        null::timestamptz as last_sent_at
      from public.trip_members m
      join auth.users u on u.id = m.user_id
      where m.trip_id = p_trip

      union all

      select
        i.id,
        null::uuid as user_id,
        i.email,
        i.role,
        false as accepted,
        i.created_at as invited_at,
        i.last_sent_at
      from public.trip_invites i
      where i.trip_id = p_trip
    ) shares
    order by shares.accepted desc, (shares.role = 'owner') desc, shares.email;
end;
$$;

create or replace function public.remove_pending_invite(p_trip uuid, p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'Only the trip owner can remove invitations.';
  end if;

  delete from public.trip_invites
  where trip_id = p_trip and id = p_invite;
end;
$$;

create or replace function public.mark_invite_sent(p_trip uuid, p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'Only the trip owner can update invitations.';
  end if;

  update public.trip_invites
  set last_sent_at = now()
  where trip_id = p_trip and id = p_invite;
end;
$$;

-- Include the pending invite id so the email function can record successful
-- delivery only after the provider accepts the message.
create or replace function public.invite_member(p_trip uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  v_invite uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'Only the trip owner can invite people.';
  end if;
  if p_role not in ('editor','viewer') then
    raise exception 'Role must be editor or viewer.';
  end if;
  if v_email = '' then
    raise exception 'Email is required.';
  end if;

  select m.user_id into v_member
  from public.trip_members m
  join auth.users u on u.id = m.user_id
  where m.trip_id = p_trip and lower(u.email) = v_email
  limit 1;

  -- Existing members have already accepted. Update their role without ever
  -- downgrading the owner. Everyone else remains pending until claim_invites()
  -- runs during their next authenticated app session.
  if v_member is not null then
    update public.trip_members
    set role = p_role
    where trip_id = p_trip and user_id = v_member and role <> 'owner';

    delete from public.trip_invites
    where trip_id = p_trip and lower(email) = v_email;

    return jsonb_build_object('status', 'added');
  end if;

  insert into public.trip_invites (trip_id, email, role)
  values (p_trip, v_email, p_role)
  on conflict (trip_id, email)
    do update set role = excluded.role
  returning id into v_invite;

  return jsonb_build_object('status', 'invited', 'inviteId', v_invite);
end;
$$;

grant execute on function public.list_trip_shares(uuid) to authenticated;
grant execute on function public.remove_pending_invite(uuid, uuid) to authenticated;
grant execute on function public.mark_invite_sent(uuid, uuid) to authenticated;
