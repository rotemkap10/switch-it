import { describe, expect, it } from "vitest";

import { decidePublisherClaimFeedback } from "@/lib/sensory/once";
import { parseSensoryPreferences } from "@/lib/sensory/preferences";

describe("decidePublisherClaimFeedback", () => {
  it("only fires on available → claimed", () => {
    expect(
      decidePublisherClaimFeedback({
        previousStatus: "available",
        nextStatus: "claimed",
        claimId: "c1",
        spotId: "s1",
      }),
    ).toEqual({ play: true, dedupeKey: "claim-received:c1" });
  });

  it("falls back to spot id when claim id is missing", () => {
    expect(
      decidePublisherClaimFeedback({
        previousStatus: "available",
        nextStatus: "claimed",
        claimId: null,
        spotId: "s1",
      }),
    ).toEqual({ play: true, dedupeKey: "claim-received:spot:s1" });
  });
});

describe("parseSensoryPreferences", () => {
  it("defaults both channels on", () => {
    expect(parseSensoryPreferences(null)).toEqual({
      sounds: true,
      haptics: true,
    });
  });

  it("ignores invalid stored JSON", () => {
    expect(parseSensoryPreferences("{nope")).toEqual({
      sounds: true,
      haptics: true,
    });
  });
});
