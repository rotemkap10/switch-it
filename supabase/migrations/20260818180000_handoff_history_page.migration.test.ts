import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260818180000_handoff_history_page.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("20260818180000 handoff history page", () => {
  it("adds a read-only paginated history RPC", () => {
    expect(migrationSql).toContain(
      "create or replace function public.get_handoff_history(",
    );
    expect(migrationSql).toContain("p_limit integer default 21");
    expect(migrationSql).toContain("p_before_at timestamptz default null");
    expect(migrationSql).toContain("p_before_id uuid default null");
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain(
      "grant execute on function public.get_handoff_history(integer, timestamptz, uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.get_handoff_history(integer, timestamptz, uuid) from anon",
    );
  });

  it("returns only the current user's terminal handoffs", () => {
    expect(migrationSql).toContain("auth.uid()");
    expect(migrationSql).toContain("NOT_AUTHENTICATED");
    expect(migrationSql).toContain(
      "claims.status in ('completed', 'cancelled', 'expired')",
    );
    expect(migrationSql).toContain("claims.seeker_id = v_uid");
    expect(migrationSql).toContain("spots.owner_id = v_uid");
    expect(migrationSql).toContain("when claims.seeker_id = v_uid then 'seeker'");
    expect(migrationSql).toContain("else 'publisher'");
  });

  it("orders by canonical event time with a stable id tie-break", () => {
    expect(migrationSql).toContain(
      "when claims.status = 'completed' then coalesce(claims.completed_at, claims.claimed_at)",
    );
    expect(migrationSql).toContain(
      "when claims.status = 'cancelled' then coalesce(claims.cancelled_at, claims.claimed_at)",
    );
    expect(migrationSql).toContain(
      "when claims.status = 'expired' then claims.expires_at",
    );
    expect(migrationSql).toContain(
      "order by history.event_at desc, history.claim_id desc",
    );
    expect(migrationSql).toContain(
      "(history.event_at, history.claim_id) < (p_before_at, p_before_id)",
    );
  });

  it("does not expose protected spot location to the seeker on old terminal handoffs", () => {
    expect(migrationSql).not.toMatch(/spots\.address as address/);
    expect(migrationSql).not.toContain("latitude");
    expect(migrationSql).not.toContain("longitude");
    expect(migrationSql).toContain("when spots.owner_id = v_uid then spots.address");
    expect(migrationSql).toContain("spots.status = 'available'");
    expect(migrationSql).toContain(
      "spots.status in ('cancelled', 'claimed', 'expired', 'completed')",
    );
    expect(migrationSql).toContain("interval '2 minutes'");
    expect(migrationSql).toContain(
      "spots.updated_at > pg_catalog.now() - interval '2 minutes'",
    );
    expect(migrationSql).toContain("else null");
    expect(migrationSql).toContain("end as address");
  });

  it("does not add retention deletes or credit mutations", () => {
    expect(migrationSql).not.toContain("delete from public.claims");
    expect(migrationSql).not.toContain("delete from public.credit_transactions");
    expect(migrationSql).not.toContain("interval '6 months'");
    expect(migrationSql).not.toContain("insert into public.credit_transactions");
    expect(migrationSql).not.toContain("update public.profiles");
    expect(migrationSql).toContain(
      "and tx.transaction_type in ('handoff_debit', 'handoff_credit')",
    );
  });
});
