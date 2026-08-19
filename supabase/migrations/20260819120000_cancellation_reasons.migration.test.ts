import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260819120000_cancellation_reasons.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function functionNamed(name: string, commentPrefix: string): string {
  const start = migrationSql.indexOf(name);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(commentPrefix, start);
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260819120000 cancellation reasons", () => {
  it("extends claims and spots without a new analytics table or credit writes", () => {
    expect(migrationSql).toContain("add column if not exists cancelled_by");
    expect(migrationSql).toContain("add column if not exists cancelled_reason");
    expect(migrationSql).toContain("add column if not exists cancelled_at");
    expect(migrationSql).not.toContain("create table");
    expect(migrationSql).not.toContain("credit_transactions");
    expect(migrationSql).not.toContain("create or replace function public.complete_claim");
  });

  it("stores machine-readable seeker and publisher reasons", () => {
    expect(migrationSql).toContain("found_another_spot");
    expect(migrationSql).toContain("cant_make_it");
    expect(migrationSql).toContain("too_far");
    expect(migrationSql).toContain("someone_else_took_spot");
    expect(migrationSql).toContain("had_to_leave");
    expect(migrationSql).toContain("cant_complete_handoff");
    expect(migrationSql).not.toContain("Found another spot");
    expect(migrationSql).not.toContain("Someone else took the spot");
  });

  it("seeker cancel_claim reopens before start and ends the listing after start", () => {
    const body = functionNamed(
      "create or replace function public.cancel_claim(",
      "comment on function public.cancel_claim(uuid, text)",
    );
    expect(body).toContain("for update");
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).toContain("NOT_SEEKER");
    expect(body).toContain("INVALID_CANCEL_REASON");
    expect(body).toContain("cancelled_by = 'seeker'");
    expect(body).toContain("status = 'available'");
    expect(body).toContain("expires_at = spots.available_at");
    expect(body).toContain("handoff_started_at is null");
    expect(body).toContain("v_now < v_spot.available_at");
    expect(body).toContain("v_spot_status := 'cancelled'");
    expect(body).not.toContain("update public.profiles");
    expect(body).not.toContain("handoff_debit");
  });

  it("publisher cancel_spot records a reason on the listing and any active claim", () => {
    const body = functionNamed(
      "create or replace function public.cancel_spot(",
      "comment on function public.cancel_spot(uuid, text)",
    );
    expect(body).toContain("for update");
    expect(body).toContain("NOT_OWNER");
    expect(body).toContain("INVALID_CANCEL_REASON");
    expect(body).toContain("cancelled_by = 'publisher'");
    expect(body).toContain("cancelled_reason = p_reason");
    expect(body).toContain("and spots.status = 'available'");
    expect(body).not.toContain("v_spot_status := 'available'");
    expect(body).not.toContain("update public.profiles");
  });

  it("drops the previous reason-less overloads", () => {
    expect(migrationSql).toContain("drop function if exists public.cancel_claim(uuid)");
    expect(migrationSql).toContain("drop function if exists public.cancel_spot(uuid)");
  });
});
