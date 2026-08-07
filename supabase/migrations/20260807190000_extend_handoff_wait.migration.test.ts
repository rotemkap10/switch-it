import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260807190000_extend_handoff_wait.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function functionBody(): string {
  const start = migrationSql.indexOf(
    "create or replace function public.extend_handoff_wait(p_claim_id uuid)",
  );
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(
    "comment on function public.extend_handoff_wait(uuid)",
    start,
  );
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260807190000 extend_handoff_wait", () => {
  it("creates extend_handoff_wait with SECURITY DEFINER and empty search_path", () => {
    const body = functionBody();
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(migrationSql).toContain(
      "revoke all on function public.extend_handoff_wait(uuid) from public",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.extend_handoff_wait(uuid) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.extend_handoff_wait(uuid) to authenticated",
    );
  });

  it("locks claim then spot and validates owner / active / claimed", () => {
    const body = functionBody();
    const claimLock = body.indexOf("from public.claims as claims");
    const spotLock = body.indexOf("from public.parking_spots as spots");
    expect(claimLock).toBeGreaterThanOrEqual(0);
    expect(spotLock).toBeGreaterThan(claimLock);
    expect(body).toContain("for update");
    expect(body).toContain("NOT_OWNER");
    expect(body).toContain("v_claim.status is distinct from 'active'");
    expect(body).toContain("v_spot.status is distinct from 'claimed'");
    expect(body).toContain("HANDOFF_NOT_READY");
    expect(body).toContain("HANDOFF_UNAVAILABLE");
  });

  it("extends from current expires_at + 2 minutes capped at available_at + 5", () => {
    const body = functionBody();
    expect(body).toContain("interval '2 minutes'");
    expect(body).toContain("available_at + interval '5 minutes'");
    expect(body).toContain("v_spot.expires_at + interval '2 minutes'");
    expect(body).toContain("least(");
    expect(body).not.toContain("pg_catalog.now() + interval '2 minutes'");
    expect(body).toContain("set expires_at = v_new_expires");
    expect(body).toMatch(
      /update public\.claims as claims\s+set expires_at = v_new_expires/i,
    );
  });

  it("does not extend legacy rows already at or past the hard cap", () => {
    const body = functionBody();
    expect(body).toContain("v_spot.expires_at >= v_hard_cap");
    // No-op path returns changed = false and preserves current expires_at.
    expect(body).toMatch(/v_spot\.expires_at,\s*v_hard_cap,\s*0,\s*false/s);
  });

  it("does not accept a client deadline timestamp parameter", () => {
    expect(migrationSql).toContain(
      "create or replace function public.extend_handoff_wait(p_claim_id uuid)",
    );
    expect(migrationSql).not.toMatch(
      /extend_handoff_wait\([^)]*timestamptz/i,
    );
  });

  it("never writes credit transactions", () => {
    expect(migrationSql).not.toContain("credit_transactions");
    expect(migrationSql).not.toContain("handoff_debit");
    expect(migrationSql).not.toContain("handoff_credit");
  });

  it("does not add a global hard-cap CHECK or scan/block legacy rows", () => {
    expect(migrationSql).not.toContain("parking_spots_expires_within_max_window");
    expect(migrationSql).not.toMatch(
      /add constraint[\s\S]*expires_at\s*<=\s*available_at/i,
    );
    expect(migrationSql).not.toContain("REFUSING");
    expect(migrationSql).not.toMatch(
      /raise exception[\s\S]*exceed available_at/i,
    );
    // No migration-time audit that aborts on historical longer windows.
    expect(migrationSql).not.toMatch(
      /where spots\.expires_at > spots\.available_at \+ interval '5 minutes'/i,
    );
    // No deploy-time backfill that shortens existing handoffs.
    expect(migrationSql).not.toMatch(
      /set\s+expires_at\s*=\s*[^;]*available_at\s*\+\s*interval\s+'2 minutes'/i,
    );
    expect(migrationSql).not.toMatch(
      /set\s+expires_at\s*=\s*[^;]*available_at\s*\+\s*interval\s+'5 minutes'/i,
    );
  });

  it("does not rewrite other handoff RPCs or Phase 9B policies", () => {
    expect(migrationSql).not.toContain("create or replace function public.cancel_spot");
    expect(migrationSql).not.toContain("create or replace function public.complete_claim");
    expect(migrationSql).not.toContain("create or replace function public.claim_spot");
    expect(migrationSql).not.toContain("can_send_claim_location");
    expect(migrationSql).not.toContain("create policy");
  });
});
