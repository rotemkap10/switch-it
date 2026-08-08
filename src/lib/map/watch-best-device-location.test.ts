import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyGpsAccuracy,
  formatGpsAccuracyLabel,
  GPS_WATCH_TIMEOUT_MS,
  isBetterGpsFix,
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
        fix({ latitude: 2, longitude: 2, accuracy: 20 }),
      ),
    ).toBe(true);
    expect(
      isBetterGpsFix(
        fix({ latitude: 1, longitude: 1, accuracy: 25 }),
        fix({ latitude: 2, longitude: 2, accuracy: 12 }),
      ),
    ).toBe(false);
  });
});

describe("watchBestDeviceLocation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the best fix and stops when accuracy is good enough", () => {
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
      timestamp: 1,
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
      timestamp: 2,
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

  it("ignores a worse later fix", () => {
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
      timestamp: 1,
    } as GeolocationPosition);
    success?.({
      coords: {
        latitude: 32.09,
        longitude: 34.79,
        accuracy: 28,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 2,
    } as GeolocationPosition);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.08, accuracy: 12 }),
    );
  });

  it("times out without a fix", () => {
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

    vi.advanceTimersByTime(1_000);

    expect(onError).toHaveBeenCalledWith("timeout");
    expect(onSettled).toHaveBeenCalledWith(null);
  });

  it("settles with the best fix when the watch times out", () => {
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
      timestamp: 1,
    } as GeolocationPosition);

    vi.advanceTimersByTime(2_000);

    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 45 }),
    );
  });

  it("stop callback clears the watch without reporting timeout", () => {
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

    stop();
    vi.advanceTimersByTime(GPS_WATCH_TIMEOUT_MS);

    expect(clearWatch).toHaveBeenCalledWith(9);
    expect(onError).not.toHaveBeenCalled();
  });

  it("maps permission denied before any fix", () => {
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

    expect(onError).toHaveBeenCalledWith("denied");
  });
});
