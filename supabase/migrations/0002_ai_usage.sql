-- GrandEase Traveler — durable AI usage tracking
--
-- Backs the per-user daily rate limit for the text-to-events edge function.
-- The previous limiter was an in-memory stub that reset on cold start and was
-- not shared across function instances; this table + RPC make it durable.
--
-- Apply this file via the Supabase SQL editor or `supabase db push` /
-- `supabase migration up`.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- RLS: no direct client access. All access goes through the SECURITY DEFINER
-- RPC below, so we enable RLS and add no policies (default deny).
-- ---------------------------------------------------------------------------

alter table public.ai_usage enable row level security;

-- ---------------------------------------------------------------------------
-- RPC: atomically bump the caller's usage for today and report whether they're
-- still under the limit. Returns TRUE if the new count is <= p_limit, else
-- FALSE. When already at/over the cap it does not keep bumping needlessly.
-- ---------------------------------------------------------------------------

create or replace function public.check_and_bump_ai_usage(p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    return false;
  end if;

  -- Peek at the current count first so we don't bump beyond the cap needlessly.
  select count into v_count
  from public.ai_usage
  where user_id = v_user and day = current_date;

  if v_count is not null and v_count >= p_limit then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, count)
  values (v_user, current_date, 1)
  on conflict (user_id, day)
    do update set count = public.ai_usage.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_and_bump_ai_usage(int) to authenticated;
