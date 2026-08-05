import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260805110000_get_handoff_counterpart_vehicle.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("get_handoff_counterpart_vehicle migration", () => {
  it("defines a security definer RPC with a fixed search_path", () => {
    expect(migrationSql).toContain(
      "create or replace function public.get_handoff_counterpart_vehicle(p_claim_id uuid)",
    );
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
  });

  it("returns only allowlisted vehicle columns", () => {
    expect(migrationSql).toContain("vehicle_license_plate text");
    expect(migrationSql).toContain("vehicle_make text");
    expect(migrationSql).toContain("vehicle_model text");
    expect(migrationSql).toContain("vehicle_color text");
    expect(migrationSql).toContain("vehicle_type text");
    expect(migrationSql).not.toContain("display_name");
    expect(migrationSql).not.toContain("credits");
    expect(migrationSql).not.toContain("email");
  });

  it("enforces participant and active-state checks", () => {
    expect(migrationSql).toContain("auth.uid()");
    expect(migrationSql).toContain("NOT_AUTHENTICATED");
    expect(migrationSql).toContain("v_claim.status is distinct from 'active'");
    expect(migrationSql).toContain("v_spot.status is distinct from 'claimed'");
    expect(migrationSql).toContain("v_claim.expires_at <= pg_catalog.now()");
    expect(migrationSql).toContain("v_spot.expires_at <= pg_catalog.now()");
  });

  it("revokes public execution and grants authenticated only", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.get_handoff_counterpart_vehicle(uuid) from public",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.get_handoff_counterpart_vehicle(uuid) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated",
    );
  });

  it("does not alter profiles RLS or table grants", () => {
    expect(migrationSql).not.toContain("create policy");
    expect(migrationSql).not.toContain("grant select on table public.profiles");
    expect(migrationSql).not.toContain("alter table public.profiles");
    expect(migrationSql).not.toContain("alter table public.claims");
    expect(migrationSql).not.toContain("alter table public.parking_spots");
  });
});
