import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260816200000_parking_spots_realtime_terminal_select_grace.sql";

describe("parking_spots realtime terminal select grace", () => {
  const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");

  it("recreates select policy with available + terminal grace", () => {
    expect(sql).toContain("drop policy if exists parking_spots_select_active_or_own");
    expect(sql).toContain("status = 'available'");
    expect(sql).toContain("'cancelled', 'claimed', 'expired', 'completed'");
    expect(sql).toContain("interval '2 minutes'");
    expect(sql).toContain("updated_at");
  });

  it("does not weaken claim RPCs or publish secrets", () => {
    expect(sql).not.toContain("claim_handoff_secrets");
    expect(sql).not.toContain("credit_transactions");
    expect(sql).not.toContain("security definer");
  });
});
