import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const requestCurrentDeviceLocation = vi.fn();

vi.mock("@/lib/map/request-current-device-location", () => ({
  requestCurrentDeviceLocation: (...args: unknown[]) =>
    requestCurrentDeviceLocation(...args),
}));

import { useMapRecenter } from "@/lib/map/use-map-recenter";

describe("useMapRecenter", () => {
  beforeEach(() => {
    requestCurrentDeviceLocation.mockReset();
  });

  it("requests location and calls onFix", async () => {
    requestCurrentDeviceLocation.mockResolvedValue({
      ok: true,
      fix: {
        latitude: 32.08,
        longitude: 34.78,
        accuracy: 10,
        timestamp: 1,
      },
    });

    const onFix = vi.fn();
    const { result } = renderHook(() => useMapRecenter({ onFix }));

    await act(async () => {
      await result.current.recenter();
    });

    expect(requestCurrentDeviceLocation).toHaveBeenCalledTimes(1);
    expect(requestCurrentDeviceLocation).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      maximumAgeMs: 0,
    });
    expect(onFix).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.08, longitude: 34.78 }),
    );
    expect(result.current.pending).toBe(false);
  });

  it("ignores duplicate clicks while pending", async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    requestCurrentDeviceLocation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result } = renderHook(() => useMapRecenter({}));

    act(() => {
      void result.current.recenter();
      void result.current.recenter();
    });

    expect(requestCurrentDeviceLocation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        ok: true,
        fix: {
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 10,
          timestamp: 1,
        },
      });
    });
  });

  it("calls onError for denied permission", async () => {
    requestCurrentDeviceLocation.mockResolvedValue({
      ok: false,
      reason: "denied",
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useMapRecenter({ onError }));

    await act(async () => {
      await result.current.recenter();
    });

    expect(onError).toHaveBeenCalledWith("denied");
  });

  it("allows a second recenter after the first completes", async () => {
    requestCurrentDeviceLocation
      .mockResolvedValueOnce({
        ok: true,
        fix: {
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 10,
          timestamp: 1,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        fix: {
          latitude: 32.09,
          longitude: 34.79,
          accuracy: 10,
          timestamp: 2,
        },
      });

    const onFix = vi.fn();
    const { result } = renderHook(() => useMapRecenter({ onFix }));

    await act(async () => {
      await result.current.recenter();
    });
    await act(async () => {
      await result.current.recenter();
    });

    expect(onFix).toHaveBeenCalledTimes(2);
    expect(result.current.pending).toBe(false);
  });
});
