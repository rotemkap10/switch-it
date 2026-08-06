import { describe, expect, it } from "vitest";

import {
  isUsableAccuracy,
  parseSeekerLocationPayload,
  parseSeekerLocationStatusPayload,
} from "@/lib/location/payload";
import { LIVE_LOCATION_MAX_ACCURACY_M } from "@/lib/location/constants";

describe("seeker location payload", () => {
  const now = Date.UTC(2026, 7, 6, 12, 0, 0);
  const valid = {
    latitude: 32.08,
    longitude: 34.78,
    accuracyMeters: 12,
    headingDegrees: 90,
    sequence: 1,
    sentAt: now,
  };

  it("accepts a minimal valid payload", () => {
    expect(parseSeekerLocationPayload(valid, now)).toEqual(valid);
  });

  it("accepts null heading", () => {
    expect(
      parseSeekerLocationPayload({ ...valid, headingDegrees: null }, now)
        ?.headingDegrees,
    ).toBeNull();
  });

  it("rejects out-of-range coordinates and accuracy", () => {
    expect(
      parseSeekerLocationPayload({ ...valid, latitude: 91 }, now),
    ).toBeNull();
    expect(
      parseSeekerLocationPayload({ ...valid, longitude: -181 }, now),
    ).toBeNull();
    expect(
      parseSeekerLocationPayload({ ...valid, accuracyMeters: 0 }, now),
    ).toBeNull();
    expect(
      parseSeekerLocationPayload(
        { ...valid, accuracyMeters: LIVE_LOCATION_MAX_ACCURACY_M + 1 },
        now,
      ),
    ).toBeNull();
  });

  it("rejects non-positive sequence and far-future sentAt", () => {
    expect(parseSeekerLocationPayload({ ...valid, sequence: 0 }, now)).toBeNull();
    expect(
      parseSeekerLocationPayload({ ...valid, sentAt: now + 120_000 }, now),
    ).toBeNull();
  });

  it("rejects claim id / user fields leaking into payload shape only via extra keys still ok if core valid", () => {
    expect(
      parseSeekerLocationPayload({ ...valid, userId: "x" }, now),
    ).toMatchObject(valid);
  });

  it("parses status payloads", () => {
    expect(
      parseSeekerLocationStatusPayload(
        { status: "paused", sequence: 2, sentAt: now },
        now,
      ),
    ).toEqual({ status: "paused", sequence: 2, sentAt: now });
    expect(
      parseSeekerLocationStatusPayload(
        { status: "nope", sequence: 2, sentAt: now },
        now,
      ),
    ).toBeNull();
  });

  it("flags unusable accuracy", () => {
    expect(isUsableAccuracy(20)).toBe(true);
    expect(isUsableAccuracy(LIVE_LOCATION_MAX_ACCURACY_M + 1)).toBe(false);
    expect(isUsableAccuracy(null)).toBe(false);
  });
});
