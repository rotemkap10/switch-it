-- Auth signup profile bootstrap + RLS policies.
-- No claim/complete/cancel RPCs in this migration.

-- ---------------------------------------------------------------------------
-- Signup: create profile + initial_grant when auth.users row is inserted
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_display_name text;
begin
  chosen_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'User'
  );

  insert into public.profiles (id, display_name, credits, role)
  values (new.id, chosen_display_name, 5, 'user');

  insert into public.credit_transactions (user_id, amount, transaction_type)
  values (new.id, 5, 'initial_grant');

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger-only: bootstrap public.profiles and initial_grant credit row for new auth.users.';

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Table privileges for authenticated (anon gets nothing on these tables)
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from public;
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

revoke all on table public.parking_spots from public;
revoke all on table public.parking_spots from anon;
revoke all on table public.parking_spots from authenticated;
grant select, insert, update on table public.parking_spots to authenticated;

revoke all on table public.claims from public;
revoke all on table public.claims from anon;
revoke all on table public.claims from authenticated;
grant select on table public.claims to authenticated;

revoke all on table public.credit_transactions from public;
revoke all on table public.credit_transactions from anon;
revoke all on table public.credit_transactions from authenticated;
grant select on table public.credit_transactions to authenticated;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- parking_spots policies
-- ---------------------------------------------------------------------------
create policy parking_spots_select_active_or_own
  on public.parking_spots
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or (
      status = 'available'
      and expires_at > pg_catalog.now()
    )
  );

create policy parking_spots_insert_own
  on public.parking_spots
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- Temporary direct updates: owner may edit/cancel only while status is available.
-- Claimed/completed/expired transitions are reserved for later RPCs.
create policy parking_spots_update_own_available
  on public.parking_spots
  for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    and status = 'available'
  )
  with check (
    owner_id = (select auth.uid())
    and status in ('available', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- claims policies (read-only for clients)
-- ---------------------------------------------------------------------------
create policy claims_select_seeker_or_owner
  on public.claims
  for select
  to authenticated
  using (
    seeker_id = (select auth.uid())
    or exists (
      select 1
      from public.parking_spots as spots
      where spots.id = claims.spot_id
        and spots.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- credit_transactions policies (read-only for clients)
-- ---------------------------------------------------------------------------
create policy credit_transactions_select_own
  on public.credit_transactions
  for select
  to authenticated
  using (user_id = (select auth.uid()));
