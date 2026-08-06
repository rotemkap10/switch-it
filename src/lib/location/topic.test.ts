import { describe, expect, it } from "vitest";

import {
  claimLocationTopic,
  normalizeClaimIdForTopic,
  parseClaimLocationTopic,
} from "@/lib/location/topic";

describe("claim location topic", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("builds claim-location:<uuid> with lowercase uuid", () => {
    expect(claimLocationTopic(id.toUpperCase())).toBe(`claim-location:${id}`);
  });

  it("rejects malformed claim ids", () => {
    expect(normalizeClaimIdForTopic("not-a-uuid")).toBeNull();
    expect(claimLocationTopic("claim-location:abc")).toBeNull();
    expect(parseClaimLocationTopic("room:1")).toBeNull();
    expect(parseClaimLocationTopic("claim-location:")).toBeNull();
    expect(parseClaimLocationTopic(`claim-location:${id}x`)).toBeNull();
  });

  it("round-trips a valid topic", () => {
    const topic = claimLocationTopic(id);
    expect(topic).toBeTruthy();
    expect(parseClaimLocationTopic(topic!)).toBe(id);
  });
});
