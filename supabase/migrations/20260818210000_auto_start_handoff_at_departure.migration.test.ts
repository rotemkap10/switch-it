import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260818210000_auto_start_handoff_at_departure.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function functionNamed(name: string, commentPrefix: string): string {
  const start = migrationSql.indexOf(name);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migrationSql.indexOf(commentPrefix, start);
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("20260818210000 auto-start handoff at estimated departure", () => {
  it("does not rewrite historical migrations or drop timing columns", () => {
    expect(migrationSql).not.toContain("drop column");
    expect(migrationSql).not.toContain("alter table public.parking_spots");
    expect(migrationSql).not.toContain("create table");
  });

  it("auto-starts claimed due spots at available_at without granting extra time", () => {
    const body = functionNamed(
      "create or replace function public.auto_start_claimed_handoff_if_due(p_spot_id uuid)",
      "comment on function public.auto_start_claimed_handoff_if_due(uuid)",
    );
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("for update");
    expect(body).toContain("v_spot.status is distinct from 'claimed'");
    expect(body).toContain("v_spot.handoff_started_at is not null");
    expect(body).toContain("v_now < v_spot.available_at");
    expect(body).toContain("v_spot.expires_at <= v_now");
    expect(body).toContain("v_started := v_spot.available_at");
    expect(body).toContain("v_expires := v_spot.available_at + interval '3 minutes'");
    expect(body).toContain("and spots.handoff_started_at is null");
    expect(body).not.toContain("v_started := v_now");
    expect(body).not.toContain("credit_transactions");
    expect(migrationSql).toContain(
      "revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from authenticated",
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.auto_start_claimed_handoff_if_due(uuid) to authenticated",
    );
  });

  it("backfills only in-flight claimed spots past the estimate", () => {
    expect(migrationSql).toContain("handoff_started_at = spots.available_at");
    expect(migrationSql).toContain("spots.status = 'claimed'");
    expect(migrationSql).toContain("spots.handoff_started_at is null");
    expect(migrationSql).toContain("spots.available_at <= pg_catalog.now()");
    expect(migrationSql).toContain("spots.expires_at > pg_catalog.now()");
    expect(migrationSql).not.toMatch(
      /status in \('available',\s*'claimed'\)[\s\S]*handoff_started_at = spots.available_at/,
    );
  });

  it("reconciles due claimed handoffs inside expire_claim_if_needed", () => {
    const body = functionNamed(
      "create or replace function public.expire_claim_if_needed(p_claim_id uuid)",
      "comment on function public.expire_claim_if_needed(uuid)",
    );
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).toContain("v_auto_started");
    expect(body).toContain("if v_spot.expires_at > pg_catalog.now()");
    expect(body).toContain("set status = 'expired'");
    expect(body).not.toContain("credit_transactions");
    expect(migrationSql).toContain(
      "grant execute on function public.expire_claim_if_needed(uuid) to authenticated",
    );
  });

  it("makes I'm leaving now early-start only and does not reset an auto-start", () => {
    const body = functionNamed(
      "create or replace function public.start_handoff_now(p_spot_id uuid)",
      "comment on function public.start_handoff_now(uuid)",
    );
    expect(body).toContain("v_spot.handoff_started_at is not null");
    expect(body).toContain("already_started");
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).toContain("v_now >= v_spot.available_at");
    expect(body).toContain("v_now + interval '3 minutes'");
    expect(body).not.toContain("v_lateness_deadline");
    expect(body).not.toContain("available_at + interval '3 minutes'");
    expect(body).not.toContain("credit_transactions");
  });

  it("keeps the +2 extension hard-capped at 5 minutes from actual start", () => {
    const body = functionNamed(
      "create or replace function public.extend_handoff_wait(p_claim_id uuid)",
      "comment on function public.extend_handoff_wait(uuid)",
    );
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).toContain("HANDOFF_NOT_READY");
    expect(body).toContain("handoff_started_at + interval '5 minutes'");
    expect(body).toContain("expires_at + interval '2 minutes'");
    expect(body).not.toContain("available_at + interval '5 minutes'");
    expect(body).not.toContain("credit_transactions");
  });

  it("auto-starts before completion, still rejects before start, and preserves plate credits", () => {
    const body = functionNamed(
      "create or replace function public.complete_claim(",
      "comment on function public.complete_claim(uuid, text)",
    );
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).toContain("HANDOFF_NOT_STARTED");
    expect(body).toContain("v_spot.owner_id is distinct from v_uid");
    expect(body).toContain("NOT_OWNER");
    expect(body).toContain("right(v_seeker_digits, 2)");
    expect(body).toContain("handoff_debit");
    expect(body).toContain("handoff_credit");
    expect(body).not.toContain("v_owner_digits");
    expect(body).not.toContain("cancel_claim");
  });
});
