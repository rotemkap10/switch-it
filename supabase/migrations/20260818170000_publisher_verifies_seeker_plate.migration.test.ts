import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260818170000_publisher_verifies_seeker_plate.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function completeClaimBody(): string {
  const start = migrationSql.indexOf(
    "create or replace function public.complete_claim(",
  );
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(
    "comment on function public.complete_claim(uuid, text)",
    start,
  );
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260818170000 publisher verifies seeker plate", () => {
  it("keeps the existing complete_claim signature", () => {
    expect(migrationSql).toContain(
      "create or replace function public.complete_claim(",
    );
    expect(migrationSql).toContain("p_claim_id uuid");
    expect(migrationSql).toContain("p_plate_suffix text");
    expect(migrationSql).not.toContain("p_handoff_code");
    expect(migrationSql).toContain(
      "grant execute on function public.complete_claim(uuid, text) to authenticated",
    );
  });

  it("authorizes the parking spot owner, not the seeker", () => {
    const body = completeClaimBody();
    expect(body).toContain("v_spot.owner_id is distinct from v_uid");
    expect(body).toContain("NOT_OWNER");
    expect(body).not.toContain("v_claim.seeker_id is distinct from v_uid");
    expect(body).not.toContain("NOT_SEEKER");
  });

  it("compares the submitted suffix to the current seeker's stored plate", () => {
    const body = completeClaimBody();
    expect(body).toContain("where profiles.id = v_claim.seeker_id");
    expect(body).toContain("right(v_seeker_digits, 2)");
    expect(body).not.toContain("v_owner_digits");
    expect(body).not.toContain("right(v_owner_digits, 2)");
    expect(body).not.toContain("|| v_expected_suffix");
    expect(body).not.toContain("|| v_seeker_digits");
  });

  it("keeps attempts, cooldown, start gate, and one-time credit transfer", () => {
    const body = completeClaimBody();
    expect(body).toContain("v_max_attempts integer := 3");
    expect(body).toContain("interval '2 minutes'");
    expect(body).toContain("HANDOFF_NOT_STARTED");
    expect(body).toContain("v_spot.expires_at <= pg_catalog.now()");
    expect(body).toContain("INSUFFICIENT_CREDITS");
    expect(body).toContain("v_seeker.credits < 1");
    expect(body).toContain("'handoff_debit'");
    expect(body).toContain("'handoff_credit'");
    expect(body).toContain("already_completed");
    expect(body).not.toContain("reserved");
    expect(body).not.toContain("credit_lock");
  });

  it("does not rewrite timing or counterpart-vehicle RPCs", () => {
    expect(migrationSql).not.toContain("start_handoff_now");
    expect(migrationSql).not.toContain("extend_handoff_wait");
    expect(migrationSql).not.toContain("get_handoff_counterpart_vehicle");
    expect(migrationSql).not.toContain("handoff_started_at =");
    expect(migrationSql).not.toContain("create table");
  });
});
