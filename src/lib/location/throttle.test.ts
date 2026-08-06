import { describe, expect, it } from "vitest";

import {
  LIVE_LOCATION_HEARTBEAT_MS,
  LIVE_LOCATION_MIN_SEND_INTERVAL_MS,
} from "@/lib/location/constants";
import { shouldBroadcastLocation } from "@/lib/location/throttle";

describe("shouldBroadcastLocation", () => {
  const base = {
    latitude: 32.08,
    longitude: 34.78,
    accuracyMeters: 15,
    headingDegrees: 10 as number | null,
    atMs: 1_000_000,
  };

  it("sends the first sample", () => {
    expect(shouldBroadcastLocation(null, base)).toEqual({
      send: true,
      reason: "first",
    });
  });

  it("blocks floods under the hard minimum interval", () => {
    expect(
      shouldBroadcastLocation(base, {
        ...base,
        atMs: base.atMs + LIVE_LOCATION_MIN_SEND_INTERVAL_MS - 1,
        latitude: base.latitude + 0.001,
      }),
    ).toEqual({ send: false, reason: "too_soon" });
  });

  it("sends on meaningful movement after preferred interval", () => {
    expect(
      shouldBroadcastLocation(base, {
        ...base,
        atMs: base.atMs + 4_500,
        latitude: base.latitude + 0.0003, // ~33m
      }).send,
    ).toBe(true);
  });

  it("ignores tiny jitter", () => {
    expect(
      shouldBroadcastLocation(base, {
        ...base,
        atMs: base.atMs + 5_000,
        latitude: base.latitude + 0.00001,
      }),
    ).toEqual({ send: false, reason: "no_change" });
  });

  it("sends a heartbeat after idle", () => {
    expect(
      shouldBroadcastLocation(base, {
        ...base,
        atMs: base.atMs + LIVE_LOCATION_HEARTBEAT_MS,
      }),
    ).toEqual({ send: true, reason: "heartbeat" });
  });

  it("may send on substantial accuracy improvement", () => {
    expect(
      shouldBroadcastLocation(
        { ...base, accuracyMeters: 40 },
        {
          ...base,
          atMs: base.atMs + LIVE_LOCATION_MIN_SEND_INTERVAL_MS,
          accuracyMeters: 10,
        },
      ).reason,
    ).toBe("accuracy");
  });
});
