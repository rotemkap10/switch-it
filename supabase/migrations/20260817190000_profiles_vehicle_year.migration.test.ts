import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260817190000_profiles_vehicle_year.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("vehicle year migration", () => {
  it("adds a nullable integer year without requiring it", () => {
    expect(migrationSql).toContain("add column if not exists vehicle_year integer");
    expect(migrationSql).toContain("profiles_vehicle_year_check");
    expect(migrationSql).toContain("vehicle_year is null");
    expect(migrationSql).toContain("vehicle_year >= 1990");
    expect(migrationSql).toContain(
      "vehicle_year <= (extract(year from current_date)::integer + 1)",
    );
  });

  it("extends own-profile vehicle UPDATE grants to include year", () => {
    expect(migrationSql).toContain(
      "revoke update on table public.profiles from authenticated",
    );
    expect(migrationSql).toContain("vehicle_year,");
    expect(migrationSql).toContain("grant update (");
    expect(migrationSql).toContain("vehicle_photo_path");
  });

  it("recreates the counterpart RPC with vehicle_year and the same participant checks", () => {
    expect(migrationSql).toContain(
      "drop function if exists public.get_handoff_counterpart_vehicle(uuid)",
    );
    expect(migrationSql).toContain("vehicle_year integer");
    expect(migrationSql).toContain("profiles.vehicle_year");
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
});
