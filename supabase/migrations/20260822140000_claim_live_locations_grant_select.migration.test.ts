import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260822140000_claim_live_locations_grant_select.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("claim_live_locations grant select migration", () => {
  it("grants authenticated SELECT so RLS policies can apply", () => {
    expect(migrationSql).toContain(
      "grant select on table public.claim_live_locations to authenticated",
    );
  });
});
