import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260818200000_drop_vehicle_photos.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("20260818200000 drop vehicle photos", () => {
  it("drops profiles.vehicle_photo_path and the photo-path check", () => {
    expect(migrationSql).toContain(
      "drop constraint if exists profiles_vehicle_photo_path_check",
    );
    expect(migrationSql).toContain(
      "drop column if exists vehicle_photo_path",
    );
    expect(migrationSql).toContain("vehicle_year");
    expect(migrationSql).toContain("vehicle_type");
    expect(migrationSql).not.toMatch(
      /grant update \([\s\S]*vehicle_photo_path/,
    );
  });

  it("does not return vehicle photos from the counterpart RPC", () => {
    expect(migrationSql).not.toContain("get_handoff_counterpart_vehicle");
  });

  it("removes vehicle-photos Storage policies without deleting objects", () => {
    expect(migrationSql).toContain(
      'drop policy if exists "vehicle_photos_insert_own"',
    );
    expect(migrationSql).toContain(
      'drop policy if exists "vehicle_photos_select_own"',
    );
    expect(migrationSql).toContain(
      'drop policy if exists "vehicle_photos_update_own"',
    );
    expect(migrationSql).toContain(
      'drop policy if exists "vehicle_photos_delete_own"',
    );
    expect(migrationSql).toContain(
      'drop policy if exists "vehicle_photos_select_handoff_counterpart"',
    );
    expect(migrationSql).not.toContain("delete from storage.objects");
    expect(migrationSql).not.toContain("delete from storage.buckets");
    expect(migrationSql).not.toContain("drop table");
  });
});
