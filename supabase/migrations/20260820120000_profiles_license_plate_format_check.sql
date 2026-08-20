-- Defense in depth: store-time format for public.profiles.license_plate.
--
-- Product rules (unchanged):
--   - App writes normalize separators → digits only via normalizeLicensePlate.
--   - Accepted length remains 5–8 digits (Israeli-style MVP range).
--   - Duplicate plates across different profiles remain ALLOWED (shared vehicles).
--   - No UNIQUE / unique index on license_plate.
--
-- Existing-data strategy:
--   Do NOT rewrite, null out, or delete historical rows in this migration.
--   1) ADD CONSTRAINT … NOT VALID — enforces the check for new inserts/updates
--      immediately, even if a historical outlier exists.
--   2) VALIDATE CONSTRAINT — scans existing rows. If any non-null value fails
--      ^[0-9]{5,8}$, this statement fails loudly so an operator can inspect and
--      fix rows manually before re-applying / re-validating.
--
-- Pre-push diagnostic (run against the target DB if unsure):
--   select id, license_plate
--   from public.profiles
--   where license_plate is not null
--     and license_plate !~ '^[0-9]{5,8}$';

alter table public.profiles
  drop constraint if exists profiles_license_plate_digits_allowed;

alter table public.profiles
  add constraint profiles_license_plate_digits_allowed
  check (
    license_plate is null
    or license_plate ~ '^[0-9]{5,8}$'
  ) not valid;

alter table public.profiles
  validate constraint profiles_license_plate_digits_allowed;

comment on constraint profiles_license_plate_digits_allowed on public.profiles is
  'Canonical stored plates are digits only, length 5–8. NULL allowed for incomplete onboarding. Duplicates across profiles are intentionally allowed.';
