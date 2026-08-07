import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260807180000_expire_claim_if_needed_return_status.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function functionBody(): string {
  const start = migrationSql.indexOf(
    "create or replace function public.expire_claim_if_needed(p_claim_id uuid)",
  );
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(
    "comment on function public.expire_claim_if_needed(uuid)",
    start,
  );
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260807180000 expire_claim_if_needed return status", () => {
  it("replaces only expire_claim_if_needed with the same public signature", () => {
    expect(migrationSql).toContain(
      "create or replace function public.expire_claim_if_needed(p_claim_id uuid)",
    );
    expect(migrationSql).toContain("returns table (");
    expect(migrationSql).toContain("claim_id uuid");
    expect(migrationSql).toContain("spot_id uuid");
    expect(migrationSql).toContain("claim_status text");
    expect(migrationSql).toContain("spot_status text");
    expect(migrationSql).toContain("changed boolean");

    expect(migrationSql).not.toContain("create or replace function public.cancel_claim");
    expect(migrationSql).not.toContain("create or replace function public.cancel_spot");
    expect(migrationSql).not.toContain("create or replace function public.complete_claim");
    expect(migrationSql).not.toContain("create or replace function public.claim_spot");
    expect(migrationSql).not.toContain(
      "create or replace function public.expire_spot_if_needed",
    );
  });

  it("preserves SECURITY DEFINER, empty search_path, and authenticated-only EXECUTE", () => {
    const body = functionBody();
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(migrationSql).toContain(
      "revoke all on function public.expire_claim_if_needed(uuid) from public",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.expire_claim_if_needed(uuid) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.expire_claim_if_needed(uuid) to authenticated",
    );
  });

  it("does not hard-code spot_status = expired on the mutation return path", () => {
    const body = functionBody();
    // Old bug: return query select ..., 'expired'::text, 'expired'::text, true
    expect(body).not.toMatch(
      /return query\s+select\s+[\s\S]*?'expired'::text\s*,\s*'expired'::text\s*,\s*true/i,
    );
  });

  it("re-selects actual persisted claim and spot statuses before returning", () => {
    const body = functionBody();
    expect(body).toContain("v_final_claim_status");
    expect(body).toContain("v_final_spot_status");
    expect(body).toMatch(
      /select\s+claims\.status\s+into\s+v_final_claim_status/i,
    );
    expect(body).toMatch(
      /select\s+spots\.status\s+into\s+v_final_spot_status/i,
    );
    expect(body).toContain("v_final_claim_status");
    expect(body).toContain("v_final_spot_status");
    expect(body).toMatch(
      /return query\s+select\s+[\s\S]*v_final_claim_status[\s\S]*v_final_spot_status[\s\S]*true/i,
    );
  });

  it("still expires an active overdue claim and conditionally expires the spot", () => {
    const body = functionBody();
    expect(body).toContain("if v_claim.status is distinct from 'active'");
    expect(body).toContain("if v_spot.expires_at > pg_catalog.now()");
    expect(body).toContain("set status = 'expired'");
    expect(body).toContain(
      "and spots.status not in ('completed', 'cancelled', 'expired')",
    );
    expect(body).toContain("NOT_HANDOFF_PARTICIPANT");
    expect(body).toContain("for update");
  });

  it("idempotent non-active path still returns actual locked row statuses", () => {
    const body = functionBody();
    expect(body).toMatch(
      /if v_claim\.status is distinct from 'active' then[\s\S]*?v_claim\.status[\s\S]*?v_spot\.status[\s\S]*?false/i,
    );
  });

  it("does not touch credits, cancellation RPCs, History RLS, or Phase 9B", () => {
    expect(migrationSql).not.toContain("credit_transactions");
    expect(migrationSql).not.toContain("handoff_debit");
    expect(migrationSql).not.toContain("handoff_credit");
    expect(migrationSql).not.toContain("cancel_claim");
    expect(migrationSql).not.toContain("cancel_spot");
    expect(migrationSql).not.toContain("create policy");
    expect(migrationSql).not.toContain("claim-location");
    expect(migrationSql).not.toContain("can_send_claim_location");
    expect(migrationSql).not.toContain("can_receive_claim_location");
  });
});
