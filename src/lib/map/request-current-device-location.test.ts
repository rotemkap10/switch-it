import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { requestCurrentDeviceLocation } from "@/lib/map/request-current-device-location";

describe("requestCurrentDeviceLocation", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a fix on success", async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (success) => {
        success({
          coords: {
            latitude: 32.08,
            longitude: 34.78,
            accuracy: 12,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: 1000,
        } as GeolocationPosition);
      },
    );

    const result = await requestCurrentDeviceLocation();
    expect(result).toEqual({
      ok: true,
      fix: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 12,
        timestamp: 1000,
      },
    });
  });

  it("maps permission denied to denied reason", async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (_success, error) => {
        error?.({
          code: 1,
          message: "denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    );

    const result = await requestCurrentDeviceLocation();
    expect(result).toEqual({ ok: false, reason: "denied" });
  });

  it("returns unavailable on insecure context", async () => {
    vi.stubGlobal("window", { isSecureContext: false });

    const result = await requestCurrentDeviceLocation();
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
