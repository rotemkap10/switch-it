import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const edgeFunction = readFileSync(
  join(process.cwd(), "supabase/functions/handoff-seeker-location/index.ts"),
  "utf8",
);
const nextConfig = readFileSync(
  join(process.cwd(), "next.config.ts"),
  "utf8",
);

describe("security hardening contracts", () => {
  it("does not return Postgres/PostgREST detail strings to Edge Function clients", () => {
    expect(edgeFunction).toContain('return json({ error: "snapshot_failed" }, 502)');
    expect(edgeFunction).toContain('return json({ error: "broadcast_failed" }, 502)');
    expect(edgeFunction).not.toMatch(
      /return json\(\{[^}]*detail:\s*upsertError\.message/s,
    );
    expect(edgeFunction).not.toMatch(
      /return json\(\{[^}]*detail:\s*broadcastResult\.detail/s,
    );
  });

  it("rate-limits authenticated location floods via atomic upsert RPC", () => {
    expect(edgeFunction).toContain("upsert_claim_live_location");
    expect(edgeFunction).toContain('upsertStatus === "rate_limited"');
    expect(edgeFunction).toContain('return json({ error: "rate_limited" }, 429)');
    expect(edgeFunction).toContain("try_accept_claim_location_status");
    expect(edgeFunction).not.toContain('.from("claim_live_locations")');
  });

  it("sets baseline security headers for all routes", () => {
    expect(nextConfig).toContain('source: "/:path*"');
    expect(nextConfig).toContain("X-Content-Type-Options");
    expect(nextConfig).toContain("Referrer-Policy");
    expect(nextConfig).toContain("X-Frame-Options");
    expect(nextConfig).toContain("Permissions-Policy");
  });
});
