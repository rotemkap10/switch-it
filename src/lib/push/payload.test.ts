import { describe, expect, it } from "vitest";

import {
  buildHandoffPushData,
  parseHandoffPushPayload,
  pushPayloadContainsCoordinates,
} from "@/lib/push/payload";
import { handoffPathForPush } from "@/lib/push/reconcile";
import { tokenSuffix } from "@/lib/push/log-push";

describe("handoff push payload", () => {
  const claimId = "7c611153-191e-430b-940e-ba25e5399571";
  const spotId = "a0a29c9b-3257-4702-aa68-5edeaabe076c";

  it("parses structured data without coordinates", () => {
    const parsed = parseHandoffPushPayload({
      type: "spot_cancelled",
      claimId,
      spotId,
      recipientRole: "seeker",
    });
    expect(parsed).toEqual({
      type: "spot_cancelled",
      claimId,
      spotId,
      recipientRole: "seeker",
    });
    expect(
      pushPayloadContainsCoordinates(buildHandoffPushData(parsed!)),
    ).toBe(false);
  });

  it("rejects payloads that are not handoff events", () => {
    expect(parseHandoffPushPayload({ type: "promo", claimId })).toBeNull();
    expect(
      parseHandoffPushPayload({
        type: "spot_cancelled",
        claimId: "not-a-uuid",
        recipientRole: "seeker",
      }),
    ).toBeNull();
  });

  it("routes terminal seeker events to the map, publisher events to share-a-spot", () => {
    expect(
      handoffPathForPush({
        type: "spot_cancelled",
        recipientRole: "seeker",
        claimIsActive: false,
      }),
    ).toBe("/map");
    expect(
      handoffPathForPush({
        type: "driver_claimed",
        recipientRole: "publisher",
        claimIsActive: true,
      }),
    ).toBe("/spots/new");
  });

  it("logs only a short token suffix", () => {
    expect(tokenSuffix("aaaabbbbccccddddeeeeffff")).toBe("eeffff");
  });
});
