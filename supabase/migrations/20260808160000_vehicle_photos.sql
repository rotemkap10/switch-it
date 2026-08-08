-- Optional vehicle photos: private Storage bucket + profile path + handoff RPC.
-- Existing rows stay valid with vehicle_photo_path NULL (illustrated fallback).

alter table public.profiles
  add column if not exists vehicle_photo_path text;

alter table public.profiles
  drop constraint if exists profiles_vehicle_photo_path_check;

alter table public.profiles
  add constraint profiles_vehicle_photo_path_check
  check (
    vehicle_photo_path is null
    or (
      char_length(vehicle_photo_path) <= 180
      and vehicle_photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    )
  );

comment on column public.profiles.vehicle_photo_path is
  'Private storage object path in bucket vehicle-photos. NULL = illustrated fallback.';

revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  license_plate,
  vehicle_make,
  vehicle_model,
  vehicle_color,
  vehicle_type,
  vehicle_photo_path
) on table public.profiles to authenticated;

-- Recreate counterpart RPC with photo path (return type change requires drop).
drop function if exists public.get_handoff_counterpart_vehicle(uuid);

create function public.get_handoff_counterpart_vehicle(p_claim_id uuid)
returns table (
  vehicle_license_plate text,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  vehicle_type text,
  vehicle_photo_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_claim public.claims%rowtype;
  v_spot public.parking_spots%rowtype;
  v_counterpart_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select *
  into v_claim
  from public.claims as claims
  where claims.id = p_claim_id;

  if not found then
    return;
  end if;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id;

  if not found then
    return;
  end if;

  if v_claim.seeker_id is distinct from v_uid
    and v_spot.owner_id is distinct from v_uid then
    return;
  end if;

  if v_claim.status is distinct from 'active' then
    return;
  end if;

  if v_spot.status is distinct from 'claimed' then
    return;
  end if;

  if v_claim.expires_at <= pg_catalog.now() then
    return;
  end if;

  if v_spot.expires_at <= pg_catalog.now() then
    return;
  end if;

  if v_uid = v_claim.seeker_id then
    v_counterpart_id := v_spot.owner_id;
  else
    v_counterpart_id := v_claim.seeker_id;
  end if;

  return query
  select
    profiles.license_plate,
    profiles.vehicle_make,
    profiles.vehicle_model,
    profiles.vehicle_color,
    profiles.vehicle_type,
    profiles.vehicle_photo_path
  from public.profiles as profiles
  where profiles.id = v_counterpart_id;
end;
$$;

comment on function public.get_handoff_counterpart_vehicle(uuid) is
  'Return the opposite participant vehicle fields for an active claim, including optional photo path. Seeker or spot owner only; no profile ids.';

revoke all on function public.get_handoff_counterpart_vehicle(uuid) from public;
revoke all on function public.get_handoff_counterpart_vehicle(uuid) from anon;
grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated;

-- Private vehicle photo bucket. Not publicly readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-photos',
  'vehicle-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicle_photos_insert_own" on storage.objects;
drop policy if exists "vehicle_photos_select_own" on storage.objects;
drop policy if exists "vehicle_photos_update_own" on storage.objects;
drop policy if exists "vehicle_photos_delete_own" on storage.objects;
drop policy if exists "vehicle_photos_select_handoff_counterpart" on storage.objects;

create policy "vehicle_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-photos'
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
);

create policy "vehicle_photos_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy "vehicle_photos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'vehicle-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy "vehicle_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy "vehicle_photos_select_handoff_counterpart"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1
    from public.claims as claims
    join public.parking_spots as spots
      on spots.id = claims.spot_id
    where claims.status = 'active'
      and spots.status = 'claimed'
      and claims.expires_at > pg_catalog.now()
      and spots.expires_at > pg_catalog.now()
      and (
        (
          spots.owner_id = (select auth.uid())
          and claims.seeker_id::text = split_part(name, '/', 1)
        )
        or (
          claims.seeker_id = (select auth.uid())
          and spots.owner_id::text = split_part(name, '/', 1)
        )
      )
  )
);
