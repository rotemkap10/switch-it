import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260805220000_realtime_publication_spots_claims.sql",
);

describe("realtime publication migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("publishes only parking_spots and claims", () => {
    expect(sql).toContain(
      "alter publication supabase_realtime add table public.parking_spots",
    );
    expect(sql).toContain(
      "alter publication supabase_realtime add table public.claims",
    );
    expect(sql).not.toContain("add table public.profiles");
    expect(sql).not.toContain("add table public.claim_handoff_secrets");
    expect(sql).not.toContain("add table public.credit_transactions");
  });

  it("does not alter RLS policies", () => {
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("drop policy");
    expect(sql).not.toContain("alter table public.profiles");
  });
});
