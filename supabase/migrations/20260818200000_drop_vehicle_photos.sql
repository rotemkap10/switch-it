-- Remove user-uploaded vehicle photos from the product.
-- Historical migrations that introduced the column/bucket remain unchanged.
--
-- Does NOT delete existing storage.objects in bucket vehicle-photos.
-- The private bucket is left in place so any leftover files are not destroyed.

alter table public.profiles
  drop constraint if exists profiles_vehicle_photo_path_check;

alter table public.profiles
  drop column if exists vehicle_photo_path;

revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  license_plate,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  vehicle_color,
  vehicle_type
) on table public.profiles to authenticated;

drop policy if exists "vehicle_photos_insert_own" on storage.objects;
drop policy if exists "vehicle_photos_select_own" on storage.objects;
drop policy if exists "vehicle_photos_update_own" on storage.objects;
drop policy if exists "vehicle_photos_delete_own" on storage.objects;
drop policy if exists "vehicle_photos_select_handoff_counterpart" on storage.objects;
