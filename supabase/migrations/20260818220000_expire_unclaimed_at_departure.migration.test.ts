import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260818220000_expire_unclaimed_at_departure.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function functionNamed(name: string, commentPrefix: string): string {
  const start = migrationSql.indexOf(name);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(commentPrefix, start);
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260818220000 expire unclaimed spots at estimated departure", () => {
  it("does not rewrite historical migrations", () => {
    expect(migrationSql).not.toContain("drop column");
    expect(migrationSql).not.toContain("create table");
    expect(migrationSql).not.toContain(
      "create or replace function public.complete_claim",
    );
  });

  it("backfills future unclaimed listings to end at available_at and expires past ones", () => {
    expect(migrationSql).toContain("expires_at = spots.available_at");
    expect(migrationSql).toContain("spots.status = 'available'");
    expect(migrationSql).toContain("spots.handoff_started_at is null");
    expect(migrationSql).toContain("spots.available_at > pg_catalog.now()");
    expect(migrationSql).toContain("status = 'expired'");
    expect(migrationSql).toContain("spots.available_at <= pg_catalog.now()");
    expect(migrationSql).not.toContain("credit_transactions");
  });

  it("reserves the 3-minute window for claimed unstarted spots", () => {
    expect(migrationSql).toContain(
      "expires_at = spots.available_at + interval '3 minutes'",
    );
    expect(migrationSql).toContain("spots.status = 'claimed'");
  });

  it("auto-starts claimed handoffs for available_at + 3 minutes even if listing expires_at equalled available_at", () => {
    const body = functionNamed(
      "create or replace function public.auto_start_claimed_handoff_if_due(p_spot_id uuid)",
      "comment on function public.auto_start_claimed_handoff_if_due(uuid)",
    );
    expect(body).toContain("v_now >= v_spot.available_at + interval '3 minutes'");
    expect(body).toContain("v_started := v_spot.available_at");
    expect(body).toContain("v_expires := v_spot.available_at + interval '3 minutes'");
    expect(body).not.toContain("v_spot.expires_at <= v_now");
    expect(body).not.toContain("credit_transactions");
  });

  it("expires unclaimed unstarted spots at available_at without creating a handoff", () => {
    const body = functionNamed(
      "create or replace function public.expire_spot_if_needed(p_spot_id uuid)",
      "comment on function public.expire_spot_if_needed(uuid)",
    );
    expect(body).toContain("v_spot.handoff_started_at is null");
    expect(body).toContain("v_now < v_spot.available_at");
    expect(body).toContain("status = 'expired'");
    expect(body).not.toContain("handoff_started_at =");
    expect(body).not.toContain("credit_transactions");
  });

  it("rejects claims after available_at unless the live handoff already started", () => {
    const body = functionNamed(
      "create or replace function public.claim_spot(",
      "comment on function public.claim_spot(uuid, double precision, double precision)",
    );
    expect(body).toContain("SPOT_EXPIRED");
    expect(body).toContain("v_spot.handoff_started_at is null");
    expect(body).toContain("pg_catalog.now() >= v_spot.available_at");
    expect(body).toContain("v_spot.available_at + interval '3 minutes'");
    expect(body).toContain("c_max_claim_distance_m constant double precision := 1500");
    expect(body).not.toContain("credit_transactions");
    expect(body).not.toContain("update public.profiles");
  });

  it("expires an unclaimed early I'm leaving now instead of opening a 3-minute listing", () => {
    const body = functionNamed(
      "create or replace function public.start_handoff_now(p_spot_id uuid)",
      "comment on function public.start_handoff_now(uuid)",
    );
    expect(body).toContain("status is not distinct from 'available'");
    expect(body).toContain("status = 'expired'");
    expect(body).toContain("and spots.status = 'claimed'");
    expect(body).toContain("v_now + interval '3 minutes'");
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).not.toContain("credit_transactions");
  });
});
