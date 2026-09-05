import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const watchForegroundDeviceLocation = vi.fn();

vi.mock("@/lib/map/foreground-device-location", () => ({
  resolveForegroundLocationProvider: () => "browser",
  watchForegroundDeviceLocation: (...args: unknown[]) =>
    watchForegroundDeviceLocation(...args),
}));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: () => false,
}));

import {
  acquireSharedForegroundLocation,
  getSharedForegroundLocationSnapshot,
  peekTrustedSharedForegroundFix,
  resetSharedForegroundLocationForTests,
  SHARED_FOREGROUND_RELEASE_GRACE_MS,
  subscribeSharedForegroundLocation,
  waitForTrustedSharedForegroundFix,
} from "@/lib/map/shared-foreground-location";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";

function fix(
  partial: Partial<DeviceLocationFix> &
    Pick<DeviceLocationFix, "latitude" | "longitude">,
): DeviceLocationFix {
  return {
    accuracy: 12,
    timestamp: Date.now(),
    ...partial,
  };
}

describe("shared foreground location session", () => {
  let onUpdate: ((fix: DeviceLocationFix) => void) | null = null;
  let onError: ((reason: string) => void) | null = null;
  let stopWatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
    resetSharedForegroundLocationForTests();
    stopWatch = vi.fn();
    onUpdate = null;
    onError = null;
    watchForegroundDeviceLocation.mockReset();
    watchForegroundDeviceLocation.mockImplementation((callbacks) => {
      onUpdate = callbacks.onUpdate;
      onError = callbacks.onError;
      return stopWatch;
    });
  });

  afterEach(() => {
    resetSharedForegroundLocationForTests();
    vi.useRealTimers();
  });

  it("starts one native/browser watch for multiple consumers", () => {
    const releaseA = acquireSharedForegroundLocation("find-parking");
    const releaseB = acquireSharedForegroundLocation("share-spot");
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(1);
    expect(getSharedForegroundLocationSnapshot().activeConsumerCount).toBe(2);
    releaseA();
    releaseB();
  });

  it("does not start duplicate watches while consumers remain", () => {
    const releaseA = acquireSharedForegroundLocation("find-parking");
    acquireSharedForegroundLocation("find-parking-2")();
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(1);
    releaseA();
  });

  it("rejects cached Herzliya-like old timestamps from becoming trusted", () => {
    acquireSharedForegroundLocation("share-spot");
    const herzliya = fix({
      latitude: 32.164,
      longitude: 34.846,
      accuracy: 5,
      timestamp: Date.now() - 60_000,
    });
    onUpdate?.(herzliya);
    expect(peekTrustedSharedForegroundFix()).toBeNull();
    expect(getSharedForegroundLocationSnapshot().provisionalFix).toEqual(
      herzliya,
    );
    expect(getSharedForegroundLocationSnapshot().status).toBe("acquiring");
  });

  it("accepts a fresh trusted fix and prefers it over older high accuracy", () => {
    acquireSharedForegroundLocation("share-spot");
    onUpdate?.(
      fix({
        latitude: 32.164,
        longitude: 34.846,
        accuracy: 5,
        timestamp: Date.now() - 8_000,
      }),
    );
    expect(peekTrustedSharedForegroundFix()).toBeNull();

    const current = fix({
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy: 18,
      timestamp: Date.now(),
    });
    onUpdate?.(current);
    expect(peekTrustedSharedForegroundFix()).toEqual(current);
  });

  it("preserves trusted fix across Find → Share consumer handoff", () => {
    const releaseFind = acquireSharedForegroundLocation("find-parking");
    const current = fix({
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy: 14,
      timestamp: Date.now(),
    });
    onUpdate?.(current);
    expect(peekTrustedSharedForegroundFix()).toEqual(current);

    releaseFind();
    const releaseShare = acquireSharedForegroundLocation("share-spot");
    expect(peekTrustedSharedForegroundFix()).toEqual(current);
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(1);
    expect(stopWatch).not.toHaveBeenCalled();
    releaseShare();
  });

  it("stops the watch after release grace when no consumers remain", () => {
    const release = acquireSharedForegroundLocation("find-parking");
    release();
    expect(stopWatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SHARED_FOREGROUND_RELEASE_GRACE_MS + 10);
    expect(stopWatch).toHaveBeenCalledTimes(1);
    expect(getSharedForegroundLocationSnapshot().watchActive).toBe(false);
  });

  it("notifies subscribers when a trusted fix arrives", () => {
    const listener = vi.fn();
    acquireSharedForegroundLocation("find-parking");
    subscribeSharedForegroundLocation(listener);
    listener.mockClear();
    const current = fix({
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 11,
      timestamp: Date.now(),
    });
    onUpdate?.(current);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        trustedFix: current,
        status: "ready",
      }),
    );
  });

  it("waitForTrusted resolves immediately when a fresh shared fix exists", async () => {
    acquireSharedForegroundLocation("find-parking");
    const current = fix({
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 10,
      timestamp: Date.now(),
    });
    onUpdate?.(current);

    const result = await waitForTrustedSharedForegroundFix("recenter");
    expect(result).toEqual({ ok: true, fix: current });
  });

  it("pauses the watch in background and resumes for active consumers", () => {
    acquireSharedForegroundLocation("find-parking");
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(stopWatch).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(2);
  });

  it("surfaces watch errors when no trusted fix exists", () => {
    acquireSharedForegroundLocation("share-spot");
    onError?.("denied");
    expect(getSharedForegroundLocationSnapshot()).toEqual(
      expect.objectContaining({
        status: "error",
        error: "denied",
        trustedFix: null,
      }),
    );
  });

  it("starts a new watch when re-acquired after a GPS error", () => {
    watchForegroundDeviceLocation.mockImplementation((callbacks) => {
      callbacks.onError("unavailable");
      return stopWatch;
    });
    const release = acquireSharedForegroundLocation("share-spot");
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(1);
    expect(getSharedForegroundLocationSnapshot()).toEqual(
      expect.objectContaining({
        status: "error",
        error: "unavailable",
        watchActive: false,
      }),
    );

    watchForegroundDeviceLocation.mockImplementation((callbacks) => {
      onUpdate = callbacks.onUpdate;
      onError = callbacks.onError;
      return stopWatch;
    });
    release();
    acquireSharedForegroundLocation("share-spot");
    expect(watchForegroundDeviceLocation).toHaveBeenCalledTimes(2);
    expect(getSharedForegroundLocationSnapshot().status).toBe("acquiring");
    onUpdate?.(
      fix({
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 12,
        timestamp: Date.now(),
      }),
    );
    expect(peekTrustedSharedForegroundFix()).toEqual(
      expect.objectContaining({
        latitude: 32.26,
        longitude: 34.89,
      }),
    );
  });
});
