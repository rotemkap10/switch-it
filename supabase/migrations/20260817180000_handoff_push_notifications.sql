-- Native handoff push: device tokens + notification outbox.
-- Sending is asynchronous (pg_net / webhook / drain). Mutations stay fast.
--
-- Event mapping (real statuses):
--   claims INSERT status=active
--     → driver_claimed to parking_spots.owner_id
--   claims UPDATE active → completed
--     → handoff_completed to seeker + publisher
--   parking_spots UPDATE claimed → cancelled  (cancel_spot with an active claim)
--     → spot_cancelled to the cancelled claim's seeker
--     (does NOT enqueue seeker_cancelled)
--   parking_spots UPDATE claimed → available  (cancel_claim before deadline)
--     → seeker_cancelled to the publisher
--   enqueue_handoff_expiring_soon() (pg_cron, ~60s before parking_spots.expires_at)
--     → handoff_expiring_soon to both, once per recipient via dedupe_key
--   handoff-seeker-location Edge Function, 150m straight-line, once via dedupe_key
--     → driver_nearby to publisher


create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;

create table if not exists private.handoff_push_runtime (
  id boolean primary key default true,
  functions_url text,
  webhook_secret text,
  constraint handoff_push_runtime_singleton check (id)
);

comment on table private.handoff_push_runtime is
  'Optional dispatch config for send-handoff-push. Dashboard Database Webhook is also valid.';

revoke all on table private.handoff_push_runtime from public;
revoke all on table private.handoff_push_runtime from anon;
revoke all on table private.handoff_push_runtime from authenticated;

-- ---------------------------------------------------------------------------
-- push_devices
-- ---------------------------------------------------------------------------
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  push_token text not null,
  device_install_id text not null,
  enabled boolean not null default true,
  last_error text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  last_seen_at timestamptz not null default pg_catalog.now(),
  constraint push_devices_token_not_blank check (char_length(push_token) >= 16),
  constraint push_devices_install_not_blank check (char_length(device_install_id) >= 8),
  constraint push_devices_push_token_key unique (push_token),
  constraint push_devices_user_install_key unique (user_id, device_install_id)
);
create index push_devices_user_enabled_idx
  on public.push_devices (user_id)
  where enabled;

comment on table public.push_devices is
  'Native push tokens. One row per install; token unique. Private to the owning user.';

alter table public.push_devices enable row level security;

revoke all on table public.push_devices from public;
revoke all on table public.push_devices from anon;
grant select, insert, update, delete on table public.push_devices to authenticated;
grant select, insert, update, delete on table public.push_devices to service_role;

create policy push_devices_select_own
  on public.push_devices
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy push_devices_insert_own
  on public.push_devices
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy push_devices_update_own
  on public.push_devices
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_devices_delete_own
  on public.push_devices
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- handoff_notification_events (outbox)
-- ---------------------------------------------------------------------------
create table public.handoff_notification_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  spot_id uuid references public.parking_spots (id) on delete set null,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_role text not null check (recipient_role in ('seeker', 'publisher')),
  type text not null check (type in (
    'spot_cancelled',
    'driver_claimed',
    'seeker_cancelled',
    'handoff_expiring_soon',
    'driver_nearby',
    'handoff_completed'
  )),
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default pg_catalog.now(),
  sent_at timestamptz,
  constraint handoff_notification_events_dedupe unique (dedupe_key)
);

create index handoff_notification_events_pending_idx
  on public.handoff_notification_events (created_at)
  where status = 'pending';

comment on table public.handoff_notification_events is
  'Server-driven handoff push outbox. Unique dedupe_key prevents duplicate sends.';

alter table public.handoff_notification_events enable row level security;

revoke all on table public.handoff_notification_events from public;
revoke all on table public.handoff_notification_events from anon;
revoke all on table public.handoff_notification_events from authenticated;
grant select, insert, update on table public.handoff_notification_events to service_role;

-- Clients never read the outbox. Service role / triggers only.

-- ---------------------------------------------------------------------------
-- Enqueue helper (triggers + service role)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_handoff_notification(
  p_claim_id uuid,
  p_spot_id uuid,
  p_recipient_user_id uuid,
  p_recipient_role text,
  p_type text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text;
begin
  if p_claim_id is null or p_recipient_user_id is null then
    return null;
  end if;

  v_key := p_type || ':' || p_claim_id::text || ':' || p_recipient_user_id::text;

  insert into public.handoff_notification_events as ev (
    claim_id,
    spot_id,
    recipient_user_id,
    recipient_role,
    type,
    dedupe_key,
    payload,
    status
  )
  values (
    p_claim_id,
    p_spot_id,
    p_recipient_user_id,
    p_recipient_role,
    p_type,
    v_key,
    coalesce(p_payload, '{}'::jsonb),
    'pending'
  )
  on conflict (dedupe_key) do nothing
  returning ev.id into v_id;

  if v_id is not null then
    raise log '[switch-it:push] push event created type=% claimId=% recipient=%',
      p_type,
      p_claim_id,
      p_recipient_user_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enqueue_handoff_notification(
  uuid, uuid, uuid, text, text, jsonb
) from public;
revoke all on function public.enqueue_handoff_notification(
  uuid, uuid, uuid, text, text, jsonb
) from anon;
revoke all on function public.enqueue_handoff_notification(
  uuid, uuid, uuid, text, text, jsonb
) from authenticated;
grant execute on function public.enqueue_handoff_notification(
  uuid, uuid, uuid, text, text, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- Client device upsert / logout disable
-- ---------------------------------------------------------------------------
create or replace function public.upsert_push_device(
  p_platform text,
  p_push_token text,
  p_device_install_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'INVALID_PLATFORM' using errcode = 'P0001';
  end if;
  if p_push_token is null or char_length(p_push_token) < 16 then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;
  if p_device_install_id is null or char_length(p_device_install_id) < 8 then
    raise exception 'INVALID_INSTALL' using errcode = 'P0001';
  end if;

  -- A token belongs to one row. Drop any other holder (reinstall / account switch).
  delete from public.push_devices as devices
  where devices.push_token = p_push_token
    and not (
      devices.user_id = v_uid
      and devices.device_install_id = p_device_install_id
    );

  insert into public.push_devices as devices (
    user_id,
    platform,
    push_token,
    device_install_id,
    enabled,
    last_error,
    updated_at,
    last_seen_at
  )
  values (
    v_uid,
    p_platform,
    p_push_token,
    p_device_install_id,
    true,
    null,
    pg_catalog.now(),
    pg_catalog.now()
  )
  on conflict (user_id, device_install_id) do update
  set
    platform = excluded.platform,
    push_token = excluded.push_token,
    enabled = true,
    last_error = null,
    updated_at = pg_catalog.now(),
    last_seen_at = pg_catalog.now()
  returning devices.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_push_device(text, text, text) from public;
revoke all on function public.upsert_push_device(text, text, text) from anon;
grant execute on function public.upsert_push_device(text, text, text) to authenticated;

create or replace function public.disable_push_device(p_device_install_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  update public.push_devices as devices
  set
    enabled = false,
    updated_at = pg_catalog.now()
  where devices.user_id = v_uid
    and devices.device_install_id = p_device_install_id
    and devices.enabled;
end;
$$;

revoke all on function public.disable_push_device(text) from public;
revoke all on function public.disable_push_device(text) from anon;
grant execute on function public.disable_push_device(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Event mapping from real claim/spot transitions
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_push_on_claim_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if TG_OP = 'INSERT' and NEW.status = 'active' then
    select spots.owner_id
    into v_owner
    from public.parking_spots as spots
    where spots.id = NEW.spot_id;

    if v_owner is not null then
      perform public.enqueue_handoff_notification(
        NEW.id,
        NEW.spot_id,
        v_owner,
        'publisher',
        'driver_claimed',
        '{}'::jsonb
      );
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE'
    and OLD.status = 'active'
    and NEW.status = 'completed'
  then
    select spots.owner_id
    into v_owner
    from public.parking_spots as spots
    where spots.id = NEW.spot_id;

    perform public.enqueue_handoff_notification(
      NEW.id,
      NEW.spot_id,
      NEW.seeker_id,
      'seeker',
      'handoff_completed',
      '{}'::jsonb
    );
    if v_owner is not null then
      perform public.enqueue_handoff_notification(
        NEW.id,
        NEW.spot_id,
        v_owner,
        'publisher',
        'handoff_completed',
        '{}'::jsonb
      );
    end if;
  end if;

  return NEW;
end;
$$;

create trigger claims_enqueue_handoff_push
  after insert or update of status on public.claims
  for each row
  execute function public.enqueue_push_on_claim_change();

create or replace function public.enqueue_push_on_spot_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims%rowtype;
begin
  -- Publisher cancelled a claimed handoff → notify seeker only.
  if OLD.status = 'claimed'
    and NEW.status = 'cancelled'
  then
    select *
    into v_claim
    from public.claims as claims
    where claims.spot_id = NEW.id
      and claims.status = 'cancelled'
    order by claims.cancelled_at desc nulls last
    limit 1;

    if found then
      perform public.enqueue_handoff_notification(
        v_claim.id,
        NEW.id,
        v_claim.seeker_id,
        'seeker',
        'spot_cancelled',
        '{}'::jsonb
      );
    end if;
    return NEW;
  end if;

  -- Seeker released before deadline → spot reopens; notify publisher only.
  if OLD.status = 'claimed'
    and NEW.status = 'available'
  then
    select *
    into v_claim
    from public.claims as claims
    where claims.spot_id = NEW.id
      and claims.status = 'cancelled'
    order by claims.cancelled_at desc nulls last
    limit 1;

    if found then
      perform public.enqueue_handoff_notification(
        v_claim.id,
        NEW.id,
        NEW.owner_id,
        'publisher',
        'seeker_cancelled',
        '{}'::jsonb
      );
    end if;
  end if;

  return NEW;
end;
$$;

create trigger parking_spots_enqueue_handoff_push
  after update of status on public.parking_spots
  for each row
  execute function public.enqueue_push_on_spot_change();

-- ---------------------------------------------------------------------------
-- Expiring-soon: 60s before shared deadline (handoff windows are 2–5 min)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_handoff_expiring_soon()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
begin
  for rec in
    select
      claims.id as claim_id,
      claims.spot_id,
      claims.seeker_id,
      spots.owner_id
    from public.claims as claims
    join public.parking_spots as spots
      on spots.id = claims.spot_id
    where claims.status = 'active'
      and spots.status = 'claimed'
      and spots.expires_at > pg_catalog.now()
      and spots.expires_at <= pg_catalog.now() + interval '60 seconds'
  loop
    perform public.enqueue_handoff_notification(
      rec.claim_id,
      rec.spot_id,
      rec.seeker_id,
      'seeker',
      'handoff_expiring_soon',
      '{}'::jsonb
    );
    perform public.enqueue_handoff_notification(
      rec.claim_id,
      rec.spot_id,
      rec.owner_id,
      'publisher',
      'handoff_expiring_soon',
      '{}'::jsonb
    );
  end loop;
end;
$$;

revoke all on function public.enqueue_handoff_expiring_soon() from public;
revoke all on function public.enqueue_handoff_expiring_soon() from anon;
revoke all on function public.enqueue_handoff_expiring_soon() from authenticated;
grant execute on function public.enqueue_handoff_expiring_soon() to service_role;

-- ---------------------------------------------------------------------------
-- Async dispatch (non-blocking). No-ops until runtime URL/secret is set.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_handoff_push_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select runtime.functions_url, runtime.webhook_secret
  into v_url, v_secret
  from private.handoff_push_runtime as runtime
  where runtime.id
  limit 1;

  v_url := nullif(btrim(coalesce(v_url, '')), '');
  v_secret := nullif(btrim(coalesce(v_secret, '')), '');
  if v_url is null or v_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('event_id', NEW.id)
  );

  return NEW;
end;
$$;

create trigger handoff_notification_events_dispatch
  after insert on public.handoff_notification_events
  for each row
  when (NEW.status = 'pending')
  execute function public.dispatch_handoff_push_event();

-- Retry / expiring-soon every minute. Immediate cancel still uses AFTER INSERT.
do $$
begin
  perform cron.unschedule('switch-it-handoff-push-expiring');
exception
  when others then
    null;
end $$;

do $$
begin
  perform cron.unschedule('switch-it-handoff-push-drain');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'switch-it-handoff-push-expiring',
  '* * * * *',
  $$select public.enqueue_handoff_expiring_soon();$$
);

select cron.schedule(
  'switch-it-handoff-push-drain',
  '* * * * *',
  $$
  select net.http_post(
    url := runtime.functions_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || runtime.webhook_secret
    ),
    body := jsonb_build_object('drain', true)
  )
  from private.handoff_push_runtime as runtime
  where runtime.id
    and nullif(btrim(coalesce(runtime.functions_url, '')), '') is not null
    and nullif(btrim(coalesce(runtime.webhook_secret, '')), '') is not null;
  $$
);
