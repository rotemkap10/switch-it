import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260819140000_unclaimed_early_start_live_window.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const claimSpotSql = readFileSync(
  resolve(__dirname, "20260819130000_prevent_seeker_reclaim.sql"),
  "utf8",
);

function functionNamed(name: string, commentPrefix: string): string {
  const start = migrationSql.indexOf(name);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(commentPrefix, start);
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260819140000 unclaimed I'm leaving now is a live Now-style window", () => {
  it("does not add tables, credit writes, or new claim_spot", () => {
    expect(migrationSql).not.toContain("create table");
    expect(migrationSql).not.toContain("credit_transactions");
    expect(migrationSql).not.toContain("update public.profiles");
    expect(migrationSql).not.toContain("create or replace function public.claim_spot");
  });

  it("keeps an unclaimed early start available with a 3-minute live deadline", () => {
    const body = functionNamed(
      "create or replace function public.start_handoff_now(p_spot_id uuid)",
      "comment on function public.start_handoff_now(uuid)",
    );
    expect(body).toContain("for update");
    expect(body).toContain("v_now + interval '3 minutes'");
    expect(body).toContain("and spots.status = 'available'");
    expect(body).toContain("and spots.handoff_started_at is null");
    expect(body).toContain("handoff_started_at = v_started");
    expect(body).toContain("expires_at = v_expires");
    expect(body).toContain("and spots.status = 'claimed'");
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body.indexOf("handoff_started_at = v_started")).toBeLessThan(
      body.indexOf("and spots.status = 'claimed'"),
    );
  });

  it("does not rewrite available_at or move credits", () => {
    expect(migrationSql).not.toContain("available_at =");
    expect(migrationSql).not.toContain("handoff_debit");
  });

  it("claim_spot still uses remaining live expires_at when already started", () => {
    expect(claimSpotSql).toContain("v_spot.handoff_started_at is null");
    expect(claimSpotSql).toContain("v_claim_expires := v_spot.expires_at");
    expect(claimSpotSql).toContain(
      "v_claim_expires := v_spot.available_at + interval '3 minutes'",
    );
    expect(claimSpotSql).toContain("pg_catalog.now() >= v_spot.available_at");
  });
});
