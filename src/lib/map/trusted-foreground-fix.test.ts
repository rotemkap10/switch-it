import { describe, expect, it } from "vitest";

import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  evaluateTrustedCurrentFix,
  isPreferredForegroundFix,
  isTrustedCurrentFix,
  TRUSTED_FIX_MAX_AGE_MS,
  type TrackedForegroundFix,
} from "@/lib/map/trusted-foreground-fix";

function tracked(
  partial: Partial<TrackedForegroundFix> &
    Pick<DeviceLocationFix, "latitude" | "longitude">,
): TrackedForegroundFix {
  const now = Date.now();
  return {
    accuracy: 12,
    timestamp: now,
    receivedAt: now,
    ...partial,
  };
}

describe("trusted foreground fix", () => {
  it("requires age within ~5 seconds", () => {
    const now = Date.now();
    const sessionStartedAt = now - 1_000;
    expect(
      isTrustedCurrentFix(
        {
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 5,
          timestamp: now - TRUSTED_FIX_MAX_AGE_MS - 1,
        },
        sessionStartedAt,
        now,
      ),
    ).toBe(false);
    expect(
      evaluateTrustedCurrentFix(
        {
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 5,
          timestamp: now - TRUSTED_FIX_MAX_AGE_MS - 1,
        },
        sessionStartedAt,
        now,
      ).reason,
    ).toBe("too_old");
  });

  it("rejects pre-session cached timestamps", () => {
    const now = Date.now();
    const sessionStartedAt = now;
    expect(
      evaluateTrustedCurrentFix(
        {
          latitude: 32.164,
          longitude: 34.846,
          accuracy: 4,
          timestamp: now - 10_000,
        },
        sessionStartedAt,
        now,
      ).reason,
    ).toBe("too_old");
  });

  it("flags Android instant first samples as cache suspects", () => {
    const sessionStartedAt = Date.now();
    const now = sessionStartedAt + 100;
    expect(
      evaluateTrustedCurrentFix(
        {
          latitude: 32.164,
          longitude: 34.846,
          accuracy: 5,
          timestamp: now,
        },
        sessionStartedAt,
        now,
        { isAndroid: true, receivedAt: now },
      ).reason,
    ).toBe("android_instant_cache_suspect");
  });

  it("does not let cached high accuracy beat a fresh lower-accuracy fix", () => {
    const now = Date.now();
    const sessionStartedAt = now - 2_000;
    const herzliya = tracked({
      latitude: 32.164,
      longitude: 34.846,
      accuracy: 5,
      timestamp: now - 4_000,
      receivedAt: now - 4_000,
    });
    const current = tracked({
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy: 22,
      timestamp: now,
      receivedAt: now,
    });
    expect(
      isPreferredForegroundFix(current, herzliya, sessionStartedAt, now),
    ).toBe(true);
  });

  it("accepts a genuinely fresh current-session fix", () => {
    const now = Date.now();
    const sessionStartedAt = now - 2_000;
    expect(
      isTrustedCurrentFix(
        {
          latitude: 32.0853,
          longitude: 34.7818,
          accuracy: 18,
          timestamp: now - 500,
        },
        sessionStartedAt,
        now,
      ),
    ).toBe(true);
  });
});
