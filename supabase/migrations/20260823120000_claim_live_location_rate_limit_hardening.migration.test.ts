import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260823120000_claim_live_location_rate_limit_hardening.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("claim live location rate limit hardening migration", () => {
  it("uses wall-clock time after claims-row serialization", () => {
    expect(migrationSql).toContain("from public.claims");
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("v_now := pg_catalog.clock_timestamp()");
    expect(migrationSql).not.toMatch(
      /v_now timestamptz := pg_catalog\.now\(\)/,
    );
  });

  it("enforces strict sequence monotonicity", () => {
    expect(migrationSql).toContain("if p_sequence <= v_live.sequence then");
    expect(migrationSql).toContain("return 'stale_sequence'");
    expect(migrationSql).not.toContain("p_location_timestamp >= v_live.location_timestamp");
  });

  it("rate-limits status broadcasts via dedicated throttle RPC", () => {
    expect(migrationSql).toContain("create table public.claim_live_status_throttle");
    expect(migrationSql).toContain(
      "create or replace function public.try_accept_claim_location_status",
    );
    expect(migrationSql).toContain("grant execute on function public.try_accept_claim_location_status");
    expect(migrationSql).toContain("to service_role");
  });

  it("keeps RPCs internal to service_role only", () => {
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("from public");
    expect(migrationSql).toContain("from anon");
    expect(migrationSql).toContain("from authenticated");
  });
});
