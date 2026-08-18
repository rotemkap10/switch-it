import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260818140000_estimated_departure_handoff_start.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function functionNamed(name: string, commentPrefix: string): string {
  const start = migrationSql.indexOf(name);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(commentPrefix, start);
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260818140000 estimated departure handoff start", () => {
  it("adds nullable start and extension columns without shortening live deadlines", () => {
    expect(migrationSql).toContain(
      "add column if not exists handoff_started_at timestamptz",
    );
    expect(migrationSql).toContain(
      "add column if not exists handoff_extension_used_at timestamptz",
    );
    expect(migrationSql).toContain(
      "drop constraint if exists parking_spots_expires_after_available",
    );
    expect(migrationSql).not.toMatch(
      /set\s+expires_at\s*=\s*[^;]*handoff_started_at\s*\+\s*interval\s+'3 minutes'/i,
    );
    expect(migrationSql).not.toMatch(
      /set\s+expires_at\s*=\s*least\s*\(/i,
    );
  });

  it("backfills already-open spots as started without rewriting a shorter expires_at", () => {
    expect(migrationSql).toContain("handoff_started_at = spots.available_at");
    expect(migrationSql).toContain("spots.available_at <= pg_catalog.now()");
    expect(migrationSql).toContain(
      "when spots.expires_at > spots.available_at + interval '3 minutes'",
    );
    expect(migrationSql).toContain(
      "and spots.expires_at < spots.available_at + interval '3 minutes'",
    );
  });

  it("starts the live window atomically and is idempotent", () => {
    const body = functionNamed(
      "create or replace function public.start_handoff_now(p_spot_id uuid)",
      "comment on function public.start_handoff_now(uuid)",
    );
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("for update");
    expect(body).toContain("and spots.handoff_started_at is null");
    expect(body).toContain("v_now + interval '3 minutes'");
    expect(body).toContain("v_now >= v_lateness_deadline");
    expect(body).toContain("already_started");
    expect(body).not.toContain("if v_now < v_spot.available_at");
    expect(body).not.toContain("credit_transactions");
    expect(migrationSql).toContain(
      "grant execute on function public.start_handoff_now(uuid) to authenticated",
    );
  });

  it("extends once from the actual start with a 5-minute hard cap", () => {
    const body = functionNamed(
      "create or replace function public.extend_handoff_wait(p_claim_id uuid)",
      "comment on function public.extend_handoff_wait(uuid)",
    );
    expect(body).toContain("v_spot.handoff_started_at is null");
    expect(body).toContain("HANDOFF_NOT_READY");
    expect(body).toContain("handoff_started_at + interval '5 minutes'");
    expect(body).toContain("expires_at + interval '2 minutes'");
    expect(body).toContain("and spots.handoff_extension_used_at is null");
    expect(body).not.toContain("available_at + interval '5 minutes'");
    expect(body).not.toContain("pg_catalog.now() < v_spot.available_at");
  });

  it("rejects completion before I'm leaving now without changing plate or credits", () => {
    const body = functionNamed(
      "create or replace function public.complete_claim(",
      "comment on function public.complete_claim(uuid, text)",
    );
    expect(body).toContain("HANDOFF_NOT_STARTED");
    expect(body).toContain("v_spot.handoff_started_at is null");
    expect(body).toContain("p_plate_suffix");
    expect(body).toContain("handoff_debit");
    expect(body).toContain("handoff_credit");
    expect(body).toContain("INVALID_PLATE_DIGITS");
  });

  it("does not rewrite cancel_claim or reset timing on claimant change", () => {
    expect(migrationSql).not.toContain(
      "create or replace function public.cancel_claim",
    );
    expect(migrationSql).not.toContain(
      "create or replace function public.claim_spot",
    );
    expect(migrationSql).not.toContain("handoff_started_at = null");
    expect(migrationSql).not.toContain("handoff_extension_used_at = null");
  });

  it("preserves claim-before-departure: latest claim_spot only gates on expires_at", () => {
    const claimSpotSql = readFileSync(
      resolve(__dirname, "20260812213000_claim_spot_max_distance.sql"),
      "utf8",
    );
    expect(claimSpotSql).toContain("v_spot.expires_at <= pg_catalog.now()");
    expect(claimSpotSql).not.toContain("v_spot.available_at");
    expect(claimSpotSql).not.toContain("handoff_started_at");
  });
});
