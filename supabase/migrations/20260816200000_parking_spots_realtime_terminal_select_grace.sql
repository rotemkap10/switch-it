-- Allow brief SELECT on recently terminal parking_spots so Realtime can deliver
-- UPDATE/DELETE to other seekers when a row leaves status = 'available'
-- (cancel / claim / expire / complete).
--
-- Without this, postgres_changes only delivers events for rows the JWT can
-- SELECT. Seekers saw INSERT (new available) but never UPDATE-to-cancelled.
-- Map list queries still filter status = 'available'; grace rows are for
-- Realtime invalidation only. Locations were already visible while available.

drop policy if exists parking_spots_select_active_or_own on public.parking_spots;

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
    or (
      status in ('cancelled', 'claimed', 'expired', 'completed')
      and updated_at > pg_catalog.now() - interval '2 minutes'
    )
  );

comment on policy parking_spots_select_active_or_own on public.parking_spots is
  'Own rows always; available non-expired for discovery; 2-minute grace on terminal statuses so Realtime UPDATE reaches other seekers.';
