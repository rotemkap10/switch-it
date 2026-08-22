import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260822150000_seeker_cancel_reopen_spot.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const preventReclaimPath = join(
  process.cwd(),
  "supabase/migrations/20260819130000_prevent_seeker_reclaim.sql",
);
const preventReclaimSql = readFileSync(preventReclaimPath, "utf8");
const cancelSpotPath = join(
  process.cwd(),
  "supabase/migrations/20260819120000_cancellation_reasons.sql",
);
const cancelSpotSql = readFileSync(cancelSpotPath, "utf8");

function cancelClaimBody(sql: string): string {
  const start = sql.indexOf("create or replace function public.cancel_claim(");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("comment on function public.cancel_claim(uuid, text)", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("20260822150000 seeker cancel reopen spot", () => {
  const body = cancelClaimBody(migrationSql);

  it("reopens the listing while expires_at remains (not only before handoff start)", () => {
    expect(body).toContain("if v_spot.expires_at > v_now then");
    expect(body).toContain("v_spot_status := 'available'");
    expect(body).not.toContain("v_spot_status := 'cancelled'");
  });

  it("restores pre-start listing deadline to available_at", () => {
    expect(body).toContain("v_pre_start_release");
    expect(body).toContain("expires_at = spots.available_at");
    expect(body).toContain("handoff_started_at is null");
    expect(body).toContain("v_now < v_spot.available_at");
  });

  it("preserves live handoff timing fields on post-start release", () => {
    expect(body).toMatch(
      /else\s+update public\.parking_spots[\s\S]*status = 'available'[\s\S]*updated_at = v_now/,
    );
    const liveHandoffUpdate = body.slice(body.indexOf("else"));
    expect(liveHandoffUpdate).not.toContain("expires_at =");
    expect(liveHandoffUpdate).not.toContain("handoff_started_at =");
    expect(liveHandoffUpdate).not.toContain("handoff_extension_used_at =");
  });

  it("expires both sides when the handoff window has ended", () => {
    expect(body).toContain("v_claim_status := 'expired'");
    expect(body).toContain("v_spot_status := 'expired'");
    expect(body).toContain("set status = 'expired'");
  });

  it("records seeker cancellation metadata without credit writes", () => {
    expect(body).toContain("cancelled_by = 'seeker'");
    expect(body).toContain("cancelled_reason = p_reason");
    expect(body).not.toContain("credit_transactions");
    expect(body).not.toContain("handoff_debit");
    expect(body).not.toContain("handoff_credit");
    expect(body).not.toContain("update public.profiles");
  });

  it("locks claim and spot rows and auto-starts handoff when due", () => {
    expect(body).toContain("for update");
    expect(body).toContain("auto_start_claimed_handoff_if_due");
    expect(body).toContain("NOT_SEEKER");
  });

  it("does not modify publisher cancel_spot", () => {
    expect(migrationSql).not.toContain("create or replace function public.cancel_spot");
    expect(cancelSpotSql).toContain("v_spot_status := 'cancelled'");
  });

  it("keeps same-seeker reclaim protection on claim_spot", () => {
    expect(preventReclaimSql).toContain("ALREADY_RELEASED_THIS_SPOT");
    expect(preventReclaimSql).toContain("cancelled_by = 'seeker'");
  });
});

describe("publisher realtime merge after post-start seeker release", () => {
  it("is covered by publisher-spot-sync tests for available spot-update hints", () => {
    expect(migrationSql).toContain("v_spot_status := 'available'");
  });
});
