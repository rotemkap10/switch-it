import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260823110000_claim_live_location_atomic_rate_limit.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("claim live location atomic rate limit migration", () => {
  it("replaces upsert_claim_live_location with a text status return", () => {
    expect(migrationSql).toContain("drop function if exists public.upsert_claim_live_location");
    expect(migrationSql).toContain("returns text");
    expect(migrationSql).toContain("return 'accepted'");
    expect(migrationSql).toContain("return 'stale_sequence'");
    expect(migrationSql).toContain("return 'rate_limited'");
  });

  it("serializes writers with row-level lock and server time", () => {
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("v_now timestamptz := pg_catalog.now()");
    expect(migrationSql).toContain("interval '2 seconds'");
    expect(migrationSql).toContain("v_now - v_live.updated_at < v_min_interval");
    expect(migrationSql).not.toContain("p_sent_at");
  });

  it("handles concurrent first-insert races", () => {
    expect(migrationSql).toContain("when unique_violation then");
  });

  it("keeps upsert internal to service_role only", () => {
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain(
      "revoke all on function public.upsert_claim_live_location",
    );
    expect(migrationSql).toContain("from public");
    expect(migrationSql).toContain("from anon");
    expect(migrationSql).toContain("from authenticated");
    expect(migrationSql).toContain("to service_role");
  });
});
