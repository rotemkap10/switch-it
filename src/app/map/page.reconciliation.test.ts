import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapPage = readFileSync(
  resolve(__dirname, "page.tsx"),
  "utf8",
);
const publisherPage = readFileSync(
  resolve(__dirname, "../spots/new/page.tsx"),
  "utf8",
);

describe("claimed handoff due-state reconciliation", () => {
  it("always reconciles the seeker's active claim, not only after expires_at", () => {
    expect(mapPage).toContain('rpc("expire_claim_if_needed"');
    expect(mapPage).toMatch(
      /seekerClaim && typeof seekerClaim\.id === "string"\) \{\s*claimIds\.add\(seekerClaim\.id\);/s,
    );
    expect(mapPage).not.toMatch(
      /isPastDue\(seekerClaim\.expires_at/,
    );
  });

  it("always reconciles the publisher's claimed spot so auto-start can land", () => {
    expect(mapPage).toMatch(
      /claimOnSpot && typeof claimOnSpot\.id === "string"\) \{\s*claimIds\.add\(claimOnSpot\.id\);/s,
    );
    expect(mapPage).not.toMatch(/isPastDue\(claimOnSpot\.expires_at/);
    expect(publisherPage).toContain('} else if (openSpot.status === "claimed")');
    expect(publisherPage).toContain('rpc("expire_claim_if_needed"');
  });

  it("always reconciles the publisher's unclaimed listing so it can expire at available_at", () => {
    expect(mapPage).toContain("expire_spot_if_needed");
    expect(mapPage).not.toMatch(/isPastDue\(/);
    expect(publisherPage).toContain('openSpot.status === "available"');
    expect(publisherPage).toContain("expire_spot_if_needed");
    expect(publisherPage).not.toMatch(/expires_at <= nowIso/);
  });

  it("hides listings this seeker voluntarily released from discovery", () => {
    expect(mapPage).toContain('eq("cancelled_by", "seeker")');
    expect(mapPage).toContain("releasedSpotIds");
  });
});
