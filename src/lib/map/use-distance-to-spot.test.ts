import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDistanceToSpot } from "@/lib/map/use-distance-to-spot";

const destination = { latitude: 32.0853, longitude: 34.7818 };

describe("useDistanceToSpot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats straight-line distance when location is available", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 32.0863,
              longitude: 34.7818,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: 1,
          } as GeolocationPosition);
          return 3;
        }),
        clearWatch: vi.fn(),
      },
    });

    const { result } = renderHook(() => useDistanceToSpot(destination));

    await waitFor(() => {
      expect(result.current.label).toMatch(/^\d+ m away$/);
    });
  });

  it("omits distance when permission is denied", async () => {
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
            return 4;
          },
        ),
        clearWatch: vi.fn(),
      },
    });

    const { result } = renderHook(() => useDistanceToSpot(destination));

    await waitFor(() => {
      expect(result.current.label).toBeNull();
    });
  });

  it("does not watch when destination coordinates are missing", () => {
    const watchPosition = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });

    const { result } = renderHook(() => useDistanceToSpot(null));

    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current.label).toBeNull();
  });
});
