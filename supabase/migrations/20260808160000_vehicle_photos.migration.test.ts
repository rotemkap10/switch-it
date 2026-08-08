import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260808160000_vehicle_photos.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("vehicle photos migration", () => {
  it("adds a nullable profile photo path without requiring it", () => {
    expect(migrationSql).toContain("add column if not exists vehicle_photo_path text");
    expect(migrationSql).toContain("profiles_vehicle_photo_path_check");
    expect(migrationSql).toContain("vehicle_photo_path is null");
  });

  it("extends own-profile vehicle UPDATE grants to include the photo path", () => {
    expect(migrationSql).toContain("revoke update on table public.profiles from authenticated");
    expect(migrationSql).toContain("vehicle_photo_path");
    expect(migrationSql).toContain("grant update (");
    expect(migrationSql).toContain("vehicle_type,");
  });

  it("recreates the counterpart RPC with photo path and the same participant checks", () => {
    expect(migrationSql).toContain(
      "drop function if exists public.get_handoff_counterpart_vehicle(uuid)",
    );
    expect(migrationSql).toContain("vehicle_photo_path text");
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("NOT_AUTHENTICATED");
    expect(migrationSql).toContain("v_claim.status is distinct from 'active'");
    expect(migrationSql).toContain("v_spot.status is distinct from 'claimed'");
    expect(migrationSql).not.toMatch(/profiles\.display_name/);
    expect(migrationSql).not.toMatch(/profiles\.credits/);
    expect(migrationSql).toContain(
      "grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.get_handoff_counterpart_vehicle(uuid) from anon",
    );
  });

  it("creates a private vehicle-photos bucket with size and mime limits", () => {
    expect(migrationSql).toContain("insert into storage.buckets");
    expect(migrationSql).toContain("'vehicle-photos'");
    expect(migrationSql).toContain("false");
    expect(migrationSql).toContain("5242880");
    expect(migrationSql).toContain("image/jpeg");
    expect(migrationSql).toContain("image/png");
    expect(migrationSql).toContain("image/webp");
    expect(migrationSql).toContain("public = false");
  });

  it("scopes storage object access to the owner and active handoff counterpart", () => {
    expect(migrationSql).toContain("vehicle_photos_insert_own");
    expect(migrationSql).toContain("vehicle_photos_select_own");
    expect(migrationSql).toContain("vehicle_photos_update_own");
    expect(migrationSql).toContain("vehicle_photos_delete_own");
    expect(migrationSql).toContain("vehicle_photos_select_handoff_counterpart");
    expect(migrationSql).toContain("split_part(name, '/', 1) = (select auth.uid())::text");
    expect(migrationSql).toContain("claims.status = 'active'");
    expect(migrationSql).toContain("spots.status = 'claimed'");
    expect(migrationSql).not.toContain("to anon");
    expect(migrationSql).not.toContain("to public");
  });
});
