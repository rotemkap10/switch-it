import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const geolocationMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
  getCurrentPosition: vi.fn(),
}));

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: geolocationMocks,
}));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: vi.fn(() => false),
}));

import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import {
  getForegroundDeviceLocation,
  resolveForegroundLocationProvider,
  watchForegroundDeviceLocation,
} from "@/lib/map/foreground-device-location";

describe("foreground-device-location", () => {
  beforeEach(() => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(false);
    geolocationMocks.checkPermissions.mockReset();
    geolocationMocks.requestPermissions.mockReset();
    geolocationMocks.watchPosition.mockReset();
    geolocationMocks.clearWatch.mockReset();
    geolocationMocks.getCurrentPosition.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects browser provider on web", () => {
    expect(resolveForegroundLocationProvider()).toBe("browser");
  });

  it("selects capacitor provider on native platforms", () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);
    expect(resolveForegroundLocationProvider()).toBe("capacitor");
  });

  it("uses browser watchPosition on web and clears a single watch", async () => {
    const clearWatch = vi.fn();
    const watchPosition = vi.fn(() => 42);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch },
    });

    const onUpdate = vi.fn();
    const stop = watchForegroundDeviceLocation({
      onUpdate,
      onError: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(geolocationMocks.watchPosition).not.toHaveBeenCalled();

    stop();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it("uses Capacitor Geolocation on native Android/iOS without starting browser watch", async () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);
    geolocationMocks.checkPermissions.mockResolvedValue({
      location: "granted",
      coarseLocation: "granted",
    });
    geolocationMocks.watchPosition.mockResolvedValue("cap-watch-1");

    const watchPosition = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });

    const onUpdate = vi.fn();
    const onError = vi.fn();
    const stop = watchForegroundDeviceLocation({
      onUpdate,
      onError,
    });
    await vi.waitFor(() => {
      expect(geolocationMocks.checkPermissions).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(
        geolocationMocks.watchPosition.mock.calls.length +
          watchPosition.mock.calls.length +
          onError.mock.calls.length,
      ).toBeGreaterThan(0);
    });

    expect(onError).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
    expect(geolocationMocks.watchPosition).toHaveBeenCalledTimes(1);
    expect(geolocationMocks.watchPosition.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        enableHighAccuracy: true,
        maximumAge: 0,
        interval: 1_000,
        minimumUpdateInterval: 500,
      }),
    );
    expect(watchPosition).not.toHaveBeenCalled();

    const callback = geolocationMocks.watchPosition.mock.calls[0]?.[1] as (
      position: {
        coords: { latitude: number; longitude: number; accuracy: number };
        timestamp: number;
      },
      error?: unknown,
    ) => void;
    callback({
      coords: { latitude: 32.26, longitude: 34.89, accuracy: 12 },
      timestamp: Date.now(),
    });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.26, accuracy: 12 }),
    );

    stop();
    await vi.waitFor(() => {
      expect(geolocationMocks.clearWatch).toHaveBeenCalledWith({
        id: "cap-watch-1",
      });
    });
  });

  it("does not start duplicate Capacitor watches for a single acquisition", async () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);
    geolocationMocks.checkPermissions.mockResolvedValue({
      location: "granted",
      coarseLocation: "granted",
    });
    geolocationMocks.watchPosition.mockResolvedValue("cap-watch-2");

    watchForegroundDeviceLocation({
      onUpdate: vi.fn(),
      onError: vi.fn(),
    });
    await vi.waitFor(() => {
      expect(geolocationMocks.watchPosition).toHaveBeenCalledTimes(1);
    });
  });

  it("getForegroundDeviceLocation uses Capacitor on native", async () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);
    geolocationMocks.checkPermissions.mockResolvedValue({
      location: "granted",
      coarseLocation: "granted",
    });
    geolocationMocks.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 32.1, longitude: 34.2, accuracy: 9 },
      timestamp: 1234,
    });

    const result = await getForegroundDeviceLocation({ maximumAgeMs: 0 });
    expect(result).toEqual({
      ok: true,
      provider: "capacitor",
      fix: {
        latitude: 32.1,
        longitude: 34.2,
        accuracy: 9,
        timestamp: 1234,
      },
    });
  });
});
