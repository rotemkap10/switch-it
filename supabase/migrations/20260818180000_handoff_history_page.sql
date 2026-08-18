-- Read-only History page helper.
-- Paginate the current user's terminal handoffs (completed / cancelled / expired)
-- by canonical event time. Does not delete, expire, or rewrite claims or credits.

create or replace function public.get_handoff_history(
  p_limit integer default 21,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  claim_id uuid,
  role text,
  status text,
  address text,
  event_at timestamptz,
  credit_amount integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_limit integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Page size is 20 in the app; 21 lets the caller detect has-more.
  v_limit := least(greatest(coalesce(p_limit, 21), 1), 21);

  return query
  with history as (
    select
      claims.id as claim_id,
      case
        when claims.seeker_id = v_uid then 'seeker'::text
        else 'publisher'::text
      end as role,
      claims.status::text as status,
      -- Address follows parking_spots SELECT RLS. SECURITY DEFINER must not
      -- leak historical location after the 2-minute terminal grace.
      case
        when spots.owner_id = v_uid then spots.address
        when
          spots.status = 'available'
          and spots.expires_at > pg_catalog.now()
          then spots.address
        when
          spots.status in ('cancelled', 'claimed', 'expired', 'completed')
          and spots.updated_at > pg_catalog.now() - interval '2 minutes'
          then spots.address
        else null
      end as address,
      case
        when claims.status = 'completed' then coalesce(claims.completed_at, claims.claimed_at)
        when claims.status = 'cancelled' then coalesce(claims.cancelled_at, claims.claimed_at)
        when claims.status = 'expired' then claims.expires_at
        else claims.claimed_at
      end as event_at
    from public.claims as claims
    inner join public.parking_spots as spots
      on spots.id = claims.spot_id
    where claims.status in ('completed', 'cancelled', 'expired')
      and (
        claims.seeker_id = v_uid
        or spots.owner_id = v_uid
      )
  )
  select
    history.claim_id,
    history.role,
    history.status,
    history.address,
    history.event_at,
    (
      select tx.amount
      from public.credit_transactions as tx
      where tx.claim_id = history.claim_id
        and tx.user_id = v_uid
        and tx.transaction_type in ('handoff_debit', 'handoff_credit')
      order by tx.created_at desc
      limit 1
    ) as credit_amount
  from history
  where
    p_before_at is null
    or p_before_id is null
    or (history.event_at, history.claim_id) < (p_before_at, p_before_id)
  order by history.event_at desc, history.claim_id desc
  limit v_limit;
end;
$$;

comment on function public.get_handoff_history(integer, timestamptz, uuid) is
  'Current user terminal handoff history, newest first. Keyset pagination via p_before_at / p_before_id. Address is returned only when parking_spots SELECT RLS would allow it (owner, live available, or 2-minute terminal grace). Never returns coordinates. Read-only; no retention deletes.';

revoke all on function public.get_handoff_history(integer, timestamptz, uuid) from public;
revoke all on function public.get_handoff_history(integer, timestamptz, uuid) from anon;
grant execute on function public.get_handoff_history(integer, timestamptz, uuid) to authenticated;
