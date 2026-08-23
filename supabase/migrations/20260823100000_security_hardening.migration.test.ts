import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260823100000_security_hardening.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("20260823100000 security hardening migration", () => {
  it("revokes dormant get_handoff_code from authenticated callers", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.get_handoff_code(uuid) from authenticated",
    );
  });
});
