import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260806140000_phase9a_shared_handoff_deadline.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

/** Slice between two section markers (exclusive of markers). */
function sectionAfter(marker: string, untilMarker?: string): string {
  const start = migrationSql.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const from = start + marker.length;
  if (!untilMarker) {
    return migrationSql.slice(from);
  }
  const end = migrationSql.indexOf(untilMarker, from);
  expect(end).toBeGreaterThan(from);
  return migrationSql.slice(from, end);
}

describe("phase9a shared handoff deadline migration", () => {
  it("documents amend-in-place because the migration was never applied remotely", () => {
    expect(migrationSql).toContain("never applied to any linked Supabase");
    expect(migrationSql).toContain("safe to amend in place");
  });

  it("locks writers with SHARE ROW EXCLUSIVE before data repairs", () => {
    const dataPrefix = migrationSql.slice(
      0,
      migrationSql.indexOf("create or replace function public.claim_spot"),
    );
    expect(dataPrefix).toContain(
      "lock table public.parking_spots, public.claims in share row exclusive mode",
    );
    expect(dataPrefix).not.toContain("access exclusive");
  });

  it("fails safely on ambiguous inconsistent historical states (counts only)", () => {
    const diagnostic = sectionAfter(
      "do $$",
      "-- Overdue active claims:",
    );
    expect(diagnostic).toContain("PHASE9A_INCONSISTENT_DATA");
    expect(diagnostic).toContain("claimed_without_active");
    expect(diagnostic).toContain("active_on_completed_or_cancelled");
    expect(diagnostic).toContain("active_on_available");
    expect(diagnostic).toContain("active_on_expired_future");
    expect(diagnostic).not.toContain("license_plate");
    expect(diagnostic).not.toContain("email");
    expect(diagnostic).not.toContain("display_name");
  });

  it("A: aligns early active claim expires_at to spot without changing status", () => {
    const backfill = sectionAfter(
      "-- Align active non-overdue claims to the shared spot deadline.",
      "-- claim_spot:",
    );
    expect(backfill).toContain("set expires_at = spots.expires_at");
    expect(backfill).toContain("claims.status = 'active'");
    expect(backfill).toContain("spots.expires_at > pg_catalog.now()");
    expect(backfill).toContain(
      "claims.expires_at is distinct from spots.expires_at",
    );
    expect(backfill).not.toContain("set status");
    expect(backfill).not.toMatch(/\bclaimed_at\s*=/);
    expect(backfill).not.toMatch(/\bavailable_at\s*=/);
    expect(backfill).not.toContain("credit_transactions");
  });

  it("B: backfill is a no-op when deadlines already match (IS DISTINCT FROM)", () => {
    expect(migrationSql).toContain(
      "claims.expires_at is distinct from spots.expires_at",
    );
  });

  it("C: hardens overdue active claims and claimed spots to expired without credits", () => {
    const harden = sectionAfter(
      "-- Overdue active claims:",
      "-- Overdue unclaimed available spots.",
    );
    expect(harden).toContain("set status = 'expired'");
    expect(harden).toContain("claims.status = 'active'");
    expect(harden).toContain("spots.expires_at <= pg_catalog.now()");
    expect(harden).toContain("spots.status not in ('completed', 'cancelled')");
    expect(harden).toContain("spots.status = 'claimed'");
    expect(harden).not.toContain("insert into public.credit_transactions");
    expect(harden).not.toMatch(/\bcompleted_at\s*=/);
    expect(harden).not.toMatch(/\bcancelled_at\s*=/);
  });

  it("D: hardens overdue unclaimed available spots", () => {
    const available = sectionAfter(
      "-- Overdue unclaimed available spots.",
      "-- Align active non-overdue claims",
    );
    expect(available).toContain("spots.status = 'available'");
    expect(available).toContain("spots.expires_at <= pg_catalog.now()");
    expect(available).toContain("and claims.status = 'active'");
    expect(available).toContain("set\n  status = 'expired'");
  });

  it("E/F: never rewrites completed or cancelled terminal rows in harden paths", () => {
    const dataPrefix = migrationSql.slice(
      0,
      migrationSql.indexOf("create or replace function public.claim_spot"),
    );
    expect(dataPrefix).toContain("spots.status not in ('completed', 'cancelled')");
    expect(dataPrefix).not.toMatch(
      /update public\.claims[\s\S]*status = 'completed'/,
    );
    expect(dataPrefix).not.toMatch(
      /update public\.parking_spots[\s\S]*status = 'completed'/,
    );
    expect(dataPrefix).not.toContain("set completed_at");
    expect(dataPrefix).not.toContain("set cancelled_at");
  });

  it("G: corrective DML is written to be idempotent on re-run", () => {
    expect(migrationSql).toContain(
      "claims.expires_at is distinct from spots.expires_at",
    );
    expect(migrationSql).toContain("and claims.status = 'active'");
    expect(migrationSql).toContain("and spots.status = 'available'");
    expect(migrationSql).toContain("and spots.status = 'claimed'");
  });

  it("orders data repairs before function replacement", () => {
    const lockAt = migrationSql.indexOf(
      "lock table public.parking_spots, public.claims",
    );
    const backfillAt = migrationSql.indexOf(
      "set expires_at = spots.expires_at",
    );
    const claimSpotAt = migrationSql.indexOf(
      "create or replace function public.claim_spot",
    );
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(backfillAt).toBeGreaterThan(lockAt);
    expect(claimSpotAt).toBeGreaterThan(backfillAt);
  });

  it("H: access RPCs use shared spot.expires_at (not an independent claim window)", () => {
    const vehicleFn = sectionAfter(
      "create or replace function public.get_handoff_counterpart_vehicle(p_claim_id uuid)",
      "create or replace function public.get_handoff_code(p_claim_id uuid)",
    );
    const codeFn = sectionAfter(
      "create or replace function public.get_handoff_code(p_claim_id uuid)",
      "create or replace function public.complete_claim(",
    );
    const completeFn = sectionAfter(
      "create or replace function public.complete_claim(",
    );

    expect(vehicleFn).toContain("v_spot.expires_at <= pg_catalog.now()");
    expect(vehicleFn).not.toContain("v_claim.expires_at");
    expect(codeFn).toContain("v_spot.expires_at <= pg_catalog.now()");
    expect(codeFn).not.toContain("v_claim.expires_at");
    expect(completeFn).toContain("v_spot.expires_at <= pg_catalog.now()");
    expect(completeFn).not.toContain("v_claim.expires_at <=");
    expect(completeFn).toContain("handoff_debit");
    expect(completeFn).toContain("handoff_credit");
    expect(completeFn).toContain("amount = -1");
    expect(completeFn).toContain("amount = 1");
  });

  it("claim_spot writes claim.expires_at = spot.expires_at with no 15-minute hold", () => {
    const claimSpot = sectionAfter(
      "create or replace function public.claim_spot(p_spot_id uuid)",
      "create or replace function public.cancel_claim(p_claim_id uuid)",
    );
    expect(claimSpot).toContain("v_spot.expires_at");
    expect(claimSpot).not.toContain("interval '15 minutes'");
    expect(claimSpot).not.toContain("least(");
  });

  it("preserves security definer, empty search_path, and execute grants", () => {
    for (const name of [
      "claim_spot",
      "cancel_claim",
      "expire_claim_if_needed",
      "expire_spot_if_needed",
      "get_handoff_counterpart_vehicle",
      "get_handoff_code",
      "complete_claim",
    ]) {
      expect(migrationSql).toContain(`function public.${name}`);
    }
    expect(migrationSql.match(/security definer/g)?.length).toBeGreaterThanOrEqual(
      7,
    );
    expect(migrationSql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(
      7,
    );
    expect(migrationSql).toContain(
      "grant execute on function public.expire_spot_if_needed(uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.complete_claim(uuid, text) to authenticated",
    );
  });

  it("does not insert credit transactions during data repair", () => {
    const dataPrefix = migrationSql.slice(
      0,
      migrationSql.indexOf("create or replace function public.claim_spot"),
    );
    expect(dataPrefix).not.toContain("credit_transactions");
    expect(dataPrefix).not.toContain("handoff_debit");
    expect(dataPrefix).not.toContain("handoff_credit");
  });
});
