import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260820120000_profiles_license_plate_format_check.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("profiles license_plate format check migration", () => {
  it("adds a CHECK for null or 5–8 digit canonical plates", () => {
    expect(migrationSql).toContain("profiles_license_plate_digits_allowed");
    expect(migrationSql).toContain("license_plate is null");
    expect(migrationSql).toContain("license_plate ~ '^[0-9]{5,8}$'");
  });

  it("uses NOT VALID then VALIDATE so existing rows are not silently rewritten", () => {
    expect(migrationSql).toMatch(/\)\s+not valid;/i);
    expect(migrationSql).toMatch(
      /validate constraint profiles_license_plate_digits_allowed/i,
    );
    expect(migrationSql).not.toMatch(
      /update\s+public\.profiles/i,
    );
    expect(migrationSql).not.toMatch(
      /delete\s+from\s+public\.profiles/i,
    );
  });

  it("does not add uniqueness on license_plate (shared vehicles allowed)", () => {
    expect(migrationSql).not.toMatch(/unique\s*\(/i);
    expect(migrationSql).not.toMatch(/create\s+unique\s+index/i);
    expect(migrationSql).not.toContain("unique (license_plate)");
  });
});
