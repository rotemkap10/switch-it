import { describe, expect, it } from "vitest";

import {
  claimLocationTopic,
  getClaimLocationTopic,
  normalizeClaimIdForTopic,
  parseClaimLocationTopic,
} from "@/lib/location/topic";
import { getClaimLocationTopic as edgeGetClaimLocationTopic } from "../../../supabase/functions/_shared/claim-location-topic";

describe("claim location topic", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("exposes one canonical builder used by sender and receiver", () => {
    expect(getClaimLocationTopic(id.toUpperCase())).toBe(`claim-location:${id}`);
    expect(getClaimLocationTopic(id)).toBe(claimLocationTopic(id));
    expect(edgeGetClaimLocationTopic(id.toUpperCase())).toBe(
      getClaimLocationTopic(id),
    );
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
