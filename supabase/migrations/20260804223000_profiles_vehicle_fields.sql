-- Additive vehicle profile fields for Switch It Phase 1.
-- Existing rows remain valid with NULL vehicle columns.
-- Signup trigger unchanged (NULL defaults).

alter table public.profiles
  add column if not exists license_plate text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_color text,
  add column if not exists vehicle_type text;

alter table public.profiles
  drop constraint if exists profiles_vehicle_color_check;

alter table public.profiles
  add constraint profiles_vehicle_color_check
  check (
    vehicle_color is null
    or vehicle_color in (
      'white',
      'black',
      'gray',
      'silver',
      'blue',
      'red',
      'green',
      'yellow',
      'brown',
      'beige',
      'other'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_vehicle_type_check;

alter table public.profiles
  add constraint profiles_vehicle_type_check
  check (
    vehicle_type is null
    or vehicle_type in (
      'mini',
      'hatchback',
      'sedan',
      'suv',
      'pickup',
      'van',
      'other'
    )
  );

-- Preserve own-profile RLS; extend only vehicle column UPDATE grants.
revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  license_plate,
  vehicle_make,
  vehicle_model,
  vehicle_color,
  vehicle_type
) on table public.profiles to authenticated;
