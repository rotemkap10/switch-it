import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyGpsAccuracy,
  formatGpsAccuracyLabel,
  GPS_FRESH_FIX_MAX_AGE_MS,
  GPS_MIN_WATCH_MS,
  GPS_STALE_FIX_MAX_AGE_MS,
  GPS_WATCH_TIMEOUT_MS,
  isBetterGpsFix,
  isFreshEnoughToStop,
  isStaleGpsFix,
  watchBestDeviceLocation,
} from "@/lib/map/watch-best-device-location";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";

function fix(
  partial: Partial<DeviceLocationFix> &
    Pick<DeviceLocationFix, "latitude" | "longitude">,
): DeviceLocationFix {
  return {
    accuracy: 10,
    timestamp: 1,
    ...partial,
  };
}

async function flushWatchStart() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("gps accuracy helpers", () => {
  it("classifies good, acceptable, and poor bands", () => {
    expect(classifyGpsAccuracy(5)).toBe("good");
    expect(classifyGpsAccuracy(15)).toBe("good");
    expect(classifyGpsAccuracy(16)).toBe("acceptable");
    expect(classifyGpsAccuracy(30)).toBe("acceptable");
    expect(classifyGpsAccuracy(31)).toBe("poor");
    expect(classifyGpsAccuracy(null)).toBe("unknown");
  });

  it("formats a rounded accuracy label", () => {
    expect(formatGpsAccuracyLabel(8.4)).toBe("Location accuracy: ±8 m");
    expect(formatGpsAccuracyLabel(null)).toBeNull();
  });

  it("prefers the lower accuracy value", () => {
    expect(
      isBetterGpsFix(fix({ latitude: 1, longitude: 1, accuracy: 8 }), null),
    ).toBe(true);
    expect(
      isBetterGpsFix(
        fix({ latitude: 1, longitude: 1, accuracy: 8 }),
        fix({ latitude: 1, longitude: 1, accuracy: 20 }),
      ),
    ).toBe(true);
    expect(
      isBetterGpsFix(
        fix({ latitude: 1, longitude: 1, accuracy: 25 }),
        fix({ latitude: 1, longitude: 1, accuracy: 12 }),
      ),
    ).toBe(false);
  });

  it("flags old timestamps as stale", () => {
    const now = Date.now();
    expect(
      isStaleGpsFix(
        fix({
          latitude: 1,
          longitude: 1,
          timestamp: now - GPS_STALE_FIX_MAX_AGE_MS - 1,
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isStaleGpsFix(fix({ latitude: 1, longitude: 1, timestamp: now }), now),
    ).toBe(false);
  });

  it("rejects Android stale high-accuracy sample in favor of fresh worse accuracy", () => {
    const now = Date.now();
    // Herzliya-style cached sample: excellent accuracy, 2 minutes old.
    const herzliya = fix({
      latitude: 32.164,
      longitude: 34.846,
      accuracy: 8,
      timestamp: now - 120_000,
    });
    const current = fix({
      latitude: 32.26,
      longitude: 34.89,
      accuracy: 16,
      timestamp: now,
    });
    expect(isStaleGpsFix(herzliya, now)).toBe(true);
    expect(isFreshEnoughToStop(herzliya, now)).toBe(false);
    expect(isBetterGpsFix(current, herzliya, now)).toBe(true);
  });

  it("prefers a fresh sample over a stale cached fix", () => {
    const now = Date.now();
    expect(
      isBetterGpsFix(
        fix({
          latitude: 32.26,
          longitude: 34.89,
          accuracy: 20,
          timestamp: now,
        }),
        fix({
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 8,
          timestamp: now - 60_000,
        }),
        now,
      ),
    ).toBe(true);
  });

  it("does not treat a moderately aged sample as fresh enough to stop", () => {
    const now = Date.now();
    expect(
      isFreshEnoughToStop(
        fix({
          latitude: 1,
          longitude: 1,
          timestamp: now - GPS_FRESH_FIX_MAX_AGE_MS - 1,
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isFreshEnoughToStop(
        fix({ latitude: 1, longitude: 1, timestamp: now }),
        now,
      ),
    ).toBe(true);
  });
});

describe("watchBestDeviceLocation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the best fix and stops when accuracy is good enough", async () => {
    let success: PositionCallback | null = null;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 7;
        }),
        clearWatch,
      },
    });

    const onUpdate = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    watchBestDeviceLocation({ onUpdate, onError, onSettled });
    await flushWatchStart();

    success?.({
      coords: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 40,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    success?.({
      coords: {
        latitude: 32.085,
        longitude: 34.781,
        accuracy: 9,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 32.085,
        longitude: 34.781,
        accuracy: 9,
      }),
    );
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 9 }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("waits a minimum window before stopping on the first good fix", async () => {
    let success: PositionCallback | null = null;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 8;
        }),
        clearWatch,
      },
    });

    watchBestDeviceLocation({
      onUpdate: vi.fn(),
      onError: vi.fn(),
      onSettled: vi.fn(),
    });
    await flushWatchStart();

    success?.({
      coords: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(clearWatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(GPS_MIN_WATCH_MS);
    expect(clearWatch).toHaveBeenCalledWith(8);
  });

  it("does not stop early on a stale high-accuracy Android sample", async () => {
    let success: PositionCallback | null = null;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 21;
        }),
        clearWatch,
      },
    });

    const onUpdate = vi.fn();
    watchBestDeviceLocation({
      onUpdate,
      onError: vi.fn(),
      onSettled: vi.fn(),
    });
    await flushWatchStart();

    // Stale Herzliya-quality cache — must not publish or stop the watch.
    success?.({
      coords: {
        latitude: 32.164,
        longitude: 34.846,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now() - 120_000,
    } as GeolocationPosition);

    expect(onUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(GPS_MIN_WATCH_MS);
    expect(clearWatch).not.toHaveBeenCalled();

    success?.({
      coords: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 16,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 16,
      }),
    );
  });

  it("ignores a worse later fix at the same place", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 3;
        }),
        clearWatch: vi.fn(),
      },
    });

    const onUpdate = vi.fn();
    watchBestDeviceLocation({
      onUpdate,
      onError: vi.fn(),
      goodEnoughAccuracyM: 5,
      timeoutMs: 20_000,
    });
    await flushWatchStart();

    success?.({
      coords: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
    success?.({
      coords: {
        latitude: 32.08001,
        longitude: 34.78001,
        accuracy: 28,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.08, accuracy: 12 }),
    );
  });

  it("times out without a fix", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn(() => 1),
        clearWatch: vi.fn(),
      },
    });

    const onError = vi.fn();
    const onSettled = vi.fn();
    watchBestDeviceLocation({
      onUpdate: vi.fn(),
      onError,
      onSettled,
      timeoutMs: 1_000,
    });
    await flushWatchStart();

    vi.advanceTimersByTime(1_000);

    expect(onError).toHaveBeenCalledWith("timeout");
    expect(onSettled).toHaveBeenCalledWith(null);
  });

  it("settles with the best fix when the watch times out", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 4;
        }),
        clearWatch: vi.fn(),
      },
    });

    const onSettled = vi.fn();
    const onError = vi.fn();
    watchBestDeviceLocation({
      onUpdate: vi.fn(),
      onError,
      onSettled,
      timeoutMs: 2_000,
      goodEnoughAccuracyM: 5,
    });
    await flushWatchStart();

    success?.({
      coords: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 45,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    vi.advanceTimersByTime(2_000);

    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 45 }),
    );
  });

  it("stop callback clears the watch without reporting timeout", async () => {
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn(() => 9),
        clearWatch,
      },
    });

    const onError = vi.fn();
    const stop = watchBestDeviceLocation({
      onUpdate: vi.fn(),
      onError,
      timeoutMs: GPS_WATCH_TIMEOUT_MS,
    });
    await flushWatchStart();

    stop();
    vi.advanceTimersByTime(GPS_WATCH_TIMEOUT_MS);

    expect(clearWatch).toHaveBeenCalledWith(9);
    expect(onError).not.toHaveBeenCalled();
  });

  it("maps permission denied before any fix", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn(
          (_success: PositionCallback, error?: PositionErrorCallback) => {
            error?.({
              code: 1,
              message: "denied",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
            return 2;
          },
        ),
        clearWatch: vi.fn(),
      },
    });

    const onError = vi.fn();
    watchBestDeviceLocation({
      onUpdate: vi.fn(),
      onError,
      onSettled: vi.fn(),
    });
    await flushWatchStart();

    expect(onError).toHaveBeenCalledWith("denied");
  });

  it("does not publish a stale cached sample and lets a fresh location win", async () => {
    let success: PositionCallback | null = null;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 11;
        }),
        clearWatch,
      },
    });

    const onUpdate = vi.fn();
    const onError = vi.fn();
    watchBestDeviceLocation({
      onUpdate,
      onError,
      onSettled: vi.fn(),
    });
    await flushWatchStart();

    success?.({
      coords: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now() - GPS_STALE_FIX_MAX_AGE_MS - 1_000,
    } as GeolocationPosition);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(clearWatch).not.toHaveBeenCalled();

    success?.({
      coords: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 18,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 18,
      }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("times out instead of settling on a stale-only cached fix", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 12;
        }),
        clearWatch: vi.fn(),
      },
    });

    const onUpdate = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    watchBestDeviceLocation({
      onUpdate,
      onError,
      onSettled,
      timeoutMs: 3_000,
    });
    await flushWatchStart();

    success?.({
      coords: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now() - GPS_STALE_FIX_MAX_AGE_MS - 1_000,
    } as GeolocationPosition);

    vi.advanceTimersByTime(3_000);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("timeout");
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 8 }),
    );
  });
});
