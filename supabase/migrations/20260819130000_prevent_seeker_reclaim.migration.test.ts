import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260819130000_prevent_seeker_reclaim.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const initialSchema = readFileSync(
  resolve(__dirname, "20260802110120_initial_schema.sql"),
  "utf8",
);

describe("20260819130000 prevent seeker reclaim of a released listing", () => {
  it("does not add tables, counters, or credit mutations", () => {
    expect(migrationSql).not.toContain("create table");
    expect(migrationSql).not.toContain("add column");
    expect(migrationSql).not.toContain("credit_transactions");
    expect(migrationSql).not.toContain("update public.profiles");
  });

  it("rejects voluntary seeker release of the same parking_spot_id only", () => {
    expect(migrationSql).toContain("ALREADY_RELEASED_THIS_SPOT");
    expect(migrationSql).toContain("previous_claims.spot_id = v_spot.id");
    expect(migrationSql).toContain("previous_claims.seeker_id = v_uid");
    expect(migrationSql).toContain("previous_claims.status = 'cancelled'");
    expect(migrationSql).toContain("previous_claims.cancelled_by = 'seeker'");
    expect(migrationSql).not.toContain("cancelled_by = 'publisher'");
  });

  it("keeps claim_spot atomic with row lock, conditional status update, and unique-violation mapping", () => {
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("and spots.status = 'available'");
    expect(migrationSql).toContain("if not found then");
    expect(migrationSql).toContain("when unique_violation then");
    expect(migrationSql).toContain("claims_one_active_per_seeker");
    expect(migrationSql).toContain("SPOT_UNAVAILABLE");
    expect(migrationSql).toContain("ACTIVE_CLAIM_EXISTS");
  });

  it("preserves future-listing vs Now claim timing", () => {
    expect(migrationSql).toContain("v_spot.handoff_started_at is null");
    expect(migrationSql).toContain("pg_catalog.now() >= v_spot.available_at");
    expect(migrationSql).toContain("SPOT_EXPIRED");
    expect(migrationSql).toContain("v_claim_expires := v_spot.expires_at");
    expect(migrationSql).toContain(
      "v_claim_expires := v_spot.available_at + interval '3 minutes'",
    );
  });

  it("relies on the existing one-active-claim invariants instead of duplicating them", () => {
    expect(initialSchema).toContain("create unique index claims_one_active_per_spot");
    expect(initialSchema).toContain("create unique index claims_one_active_per_seeker");
    expect(migrationSql).not.toContain("create unique index");
  });
});
