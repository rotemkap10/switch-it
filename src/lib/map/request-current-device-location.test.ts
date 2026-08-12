import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestCurrentDeviceLocation } from "@/lib/map/request-current-device-location";
import {
  acquireSharedForegroundLocation,
  resetSharedForegroundLocationForTests,
} from "@/lib/map/shared-foreground-location";

const watchForegroundDeviceLocation = vi.fn();

vi.mock("@/lib/map/foreground-device-location", () => ({
  resolveForegroundLocationProvider: () => "browser",
  watchForegroundDeviceLocation: (...args: unknown[]) =>
    watchForegroundDeviceLocation(...args),
}));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: () => false,
}));

describe("requestCurrentDeviceLocation", () => {
  let onUpdate: ((fix: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
  }) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
    resetSharedForegroundLocationForTests();
    onUpdate = null;
    watchForegroundDeviceLocation.mockReset();
    watchForegroundDeviceLocation.mockImplementation((callbacks) => {
      onUpdate = callbacks.onUpdate;
      return vi.fn();
    });
  });

  afterEach(() => {
    resetSharedForegroundLocationForTests();
    vi.useRealTimers();
  });

  it("returns a shared trusted fix immediately without a one-shot getCurrentPosition", async () => {
    acquireSharedForegroundLocation("find-parking");
    const current = {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 12,
      timestamp: Date.now(),
    };
    onUpdate?.(current);

    const result = await requestCurrentDeviceLocation();
    expect(result).toEqual({ ok: true, fix: current });
  });

  it("waits on the shared watch when no trusted fix exists yet", async () => {
    const pending = requestCurrentDeviceLocation({ timeoutMs: 5_000 });
    await Promise.resolve();
    expect(watchForegroundDeviceLocation).toHaveBeenCalled();
    onUpdate?.({
      latitude: 32.09,
      longitude: 34.79,
      accuracy: 15,
      timestamp: Date.now(),
    });
    await expect(pending).resolves.toEqual({
      ok: true,
      fix: {
        latitude: 32.09,
        longitude: 34.79,
        accuracy: 15,
        timestamp: Date.now(),
      },
    });
  });

  it("times out when the shared watch never yields a trusted fix", async () => {
    const pending = requestCurrentDeviceLocation({ timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ ok: false, reason: "timeout" });
  });
});
