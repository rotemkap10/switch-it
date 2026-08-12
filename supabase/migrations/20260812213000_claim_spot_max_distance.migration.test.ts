import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260812213000_claim_spot_max_distance.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("20260812213000 claim_spot max aerial distance", () => {
  it("replaces claim_spot(uuid) with seeker coordinate parameters", () => {
    expect(migrationSql).toContain("drop function if exists public.claim_spot(uuid)");
    expect(migrationSql).toContain(
      "create or replace function public.claim_spot(",
    );
    expect(migrationSql).toContain("p_spot_id uuid");
    expect(migrationSql).toContain("p_seeker_latitude double precision");
    expect(migrationSql).toContain("p_seeker_longitude double precision");
  });

  it("enforces LOCATION_REQUIRED and CLAIM_TOO_FAR with a 1500 m Haversine cap", () => {
    expect(migrationSql).toContain("raise exception 'LOCATION_REQUIRED'");
    expect(migrationSql).toContain("raise exception 'CLAIM_TOO_FAR'");
    expect(migrationSql).toContain("c_max_claim_distance_m constant double precision := 1500");
    expect(migrationSql).toContain("c_earth_radius_m constant double precision := 6371000");
    expect(migrationSql).toContain("asin(least(1.0, sqrt(v_h)))");
  });

  it("preserves atomic claim protections and authenticated-only EXECUTE", () => {
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("ACTIVE_CLAIM_EXISTS");
    expect(migrationSql).toContain("SPOT_UNAVAILABLE");
    expect(migrationSql).toContain("SELF_CLAIM");
    expect(migrationSql).toContain("INSUFFICIENT_CREDITS");
    expect(migrationSql).toContain(
      "grant execute on function public.claim_spot(uuid, double precision, double precision) to authenticated",
    );
    expect(migrationSql).not.toContain("insert into public.seeker_locations");
    expect(migrationSql).not.toContain("update public.profiles");
  });
});
