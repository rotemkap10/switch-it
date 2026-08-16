import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("broadcast_claim_location public RPC migration", () => {
  const migrationSql = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260816210000_broadcast_claim_location_public_rpc.sql",
    ),
    "utf8",
  );

  it("wraps realtime.send behind a public service_role RPC", () => {
    expect(migrationSql).toContain(
      "create or replace function public.broadcast_claim_location",
    );
    expect(migrationSql).toContain("perform realtime.send(");
    expect(migrationSql).toContain("grant execute on function public.broadcast_claim_location");
    expect(migrationSql).toContain("to service_role");
    expect(migrationSql).toContain("revoke all on function public.broadcast_claim_location");
    expect(migrationSql).toContain("from authenticated");
  });

  it("documents the PGRST106 exposed-schema failure", () => {
    expect(migrationSql).toContain("PGRST106");
    expect(migrationSql).toContain("graphql_public");
  });
});
