import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260817140000_claim_live_locations_snapshot.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("claim_live_locations snapshot migration", () => {
  it("stores at most one row per claim via primary key", () => {
    expect(migrationSql).toContain("create table public.claim_live_locations");
    expect(migrationSql).toContain("claim_id uuid primary key");
    expect(migrationSql).toContain("on delete cascade");
  });

  it("uses upsert/replace semantics with sequence ordering", () => {
    expect(migrationSql).toContain("create or replace function public.upsert_claim_live_location");
    expect(migrationSql).toContain("on conflict (claim_id) do update");
    expect(migrationSql).toContain("excluded.sequence > live.sequence");
  });

  it("restricts participant SELECT to seeker or spot owner", () => {
    expect(migrationSql).toContain("claim_live_locations_select_participants");
    expect(migrationSql).toContain("claims.seeker_id = (select auth.uid())");
    expect(migrationSql).toContain("spots.owner_id = (select auth.uid())");
    expect(migrationSql).not.toContain("using ( true )");
  });

  it("does not grant client INSERT/UPDATE/DELETE on snapshots", () => {
    expect(migrationSql).not.toMatch(
      /create policy[\s\S]*claim_live_locations[\s\S]*for insert/i,
    );
    expect(migrationSql).toContain("revoke all on function public.upsert_claim_live_location");
    expect(migrationSql).toContain("grant execute on function public.upsert_claim_live_location");
    expect(migrationSql).toContain("to service_role");
  });

  it("relies on a follow-up migration for authenticated SELECT grant", () => {
    expect(migrationSql).not.toContain(
      "grant select on table public.claim_live_locations to authenticated",
    );
  });

  it("deletes snapshots on terminal claim status via trigger", () => {
    expect(migrationSql).toContain("delete_claim_live_location_on_terminal");
    expect(migrationSql).toContain("'completed', 'cancelled', 'expired'");
    expect(migrationSql).toContain("snapshot deleted claimId=");
  });
});
