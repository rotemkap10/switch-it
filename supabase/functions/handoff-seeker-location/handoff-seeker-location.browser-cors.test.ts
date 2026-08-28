import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("handoff-seeker-location browser CORS contract", () => {
  const edge = readFileSync(
    resolve(
      process.cwd(),
      "supabase/functions/handoff-seeker-location/index.ts",
    ),
    "utf8",
  );

  it("handles OPTIONS preflight before POST parsing", () => {
    const optionsIndex = edge.indexOf('req.method === "OPTIONS"');
    const postIndex = edge.indexOf('req.method !== "POST"');
    const jsonIndex = edge.indexOf("await req.json()");
    expect(optionsIndex).toBeGreaterThan(-1);
    expect(postIndex).toBeGreaterThan(optionsIndex);
    expect(jsonIndex).toBeGreaterThan(optionsIndex);
  });

  it("allows browser origins and required cross-origin headers", () => {
    expect(edge).toContain('"Access-Control-Allow-Origin": "*"');
    expect(edge).toContain("authorization");
    expect(edge).toContain("apikey");
    expect(edge).toContain("content-type");
    expect(edge).toContain('"Access-Control-Allow-Methods": "POST, OPTIONS"');
  });

  it("includes CORS headers on JSON responses (success and error)", () => {
    expect(edge).toContain("headers: { ...CORS, \"Content-Type\": \"application/json\" }");
  });

  it("authenticates via Authorization Bearer JWT only (no native-only headers)", () => {
    expect(edge).toContain('req.headers.get("Authorization")');
    expect(edge).toContain("auth.getUser");
    expect(edge).not.toMatch(/req\.headers\.get\("X-Native/i);
    expect(edge).not.toMatch(/req\.headers\.get\("User-Agent"\)/);
  });
});
