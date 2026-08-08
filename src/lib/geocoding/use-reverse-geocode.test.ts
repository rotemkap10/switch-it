import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetReverseGeocodeCacheForTests,
  writeReverseGeocodeCache,
} from "@/lib/geocoding/reverse-geocode-cache";
import { useReverseGeocode } from "@/lib/geocoding/use-reverse-geocode";

const reverseGeocodeMock = vi.fn();

vi.mock("@/lib/geocoding/reverse-geocode", () => ({
  reverseGeocode: (...args: unknown[]) => reverseGeocodeMock(...args),
}));

describe("useReverseGeocode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reverseGeocodeMock.mockReset();
    resetReverseGeocodeCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces lookup after coordinates change", async () => {
    reverseGeocodeMock.mockResolvedValue({ label: "Main St, Tel Aviv" });

    const { rerender } = renderHook(
      ({ lat, lng }: { lat: number | null; lng: number | null }) =>
        useReverseGeocode(lat, lng, true),
      { initialProps: { lat: 32.1, lng: 34.2 } },
    );

    expect(reverseGeocodeMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(750);
    });

    expect(reverseGeocodeMock).toHaveBeenCalledTimes(1);

    rerender({ lat: 32.2, lng: 34.3 });
    await act(async () => {
      vi.advanceTimersByTime(749);
    });
    expect(reverseGeocodeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(reverseGeocodeMock).toHaveBeenCalledTimes(2);
  });

  it("ignores stale results when coordinates change quickly", async () => {
    let resolveFirst: (value: { label: string | null }) => void = () => {};
    let resolveSecond: (value: { label: string | null }) => void = () => {};

    reverseGeocodeMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender, result } = renderHook(
      ({ lat, lng }: { lat: number | null; lng: number | null }) =>
        useReverseGeocode(lat, lng, true),
      { initialProps: { lat: 32.1, lng: 34.2 } },
    );

    await act(async () => {
      vi.advanceTimersByTime(750);
    });

    rerender({ lat: 32.9, lng: 34.9 });
    await act(async () => {
      vi.advanceTimersByTime(750);
    });

    await act(async () => {
      resolveSecond({ label: "New Street, Tel Aviv" });
      await Promise.resolve();
    });

    await act(async () => {
      resolveFirst({ label: "Old Street, Tel Aviv" });
      await Promise.resolve();
    });

    expect(result.current.label).toBe("New Street, Tel Aviv");
  });

  it("marks map interaction as updating and clears publish address", () => {
    reverseGeocodeMock.mockResolvedValue({ label: "Stable St, Tel Aviv" });

    const { result } = renderHook(() => useReverseGeocode(32.1, 34.2, true));

    act(() => {
      result.current.notifyMapMoveStart();
    });

    expect(result.current.isUpdating).toBe(true);
    expect(result.current.addressForPublish).toBeNull();
  });

  it("restores the publish address when a tiny pan does not change coords", async () => {
    reverseGeocodeMock.mockResolvedValue({ label: "Stable St, Tel Aviv" });

    const { result } = renderHook(() => useReverseGeocode(32.1, 34.2, true));

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(result.current.label).toBe("Stable St, Tel Aviv");

    act(() => {
      result.current.notifyMapMoveStart();
    });
    expect(result.current.addressForPublish).toBeNull();

    act(() => {
      result.current.notifyMapMoveSettled();
    });

    expect(result.current.isUpdating).toBe(false);
    expect(result.current.addressForPublish).toBe("Stable St, Tel Aviv");
  });

  it("clears the publish address as soon as coordinates change", () => {
    reverseGeocodeMock.mockResolvedValue({ label: "Old St, Tel Aviv" });

    const { result, rerender } = renderHook(
      ({ lat, lng }: { lat: number; lng: number }) =>
        useReverseGeocode(lat, lng, true),
      { initialProps: { lat: 32.1, lng: 34.2 } },
    );

    act(() => {
      result.current.notifyMapMoveStart();
    });

    rerender({ lat: 32.2, lng: 34.3 });

    expect(result.current.addressForPublish).toBeNull();
    expect(result.current.isUpdating).toBe(true);
  });

  it("hydrates from the session cache without waiting for debounce", async () => {
    writeReverseGeocodeCache(32.0853124, 34.7818124, {
      label: "Cached Street, Tel Aviv",
    });

    const { result } = renderHook(() =>
      useReverseGeocode(32.0853124, 34.7818124, true),
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.label).toBe("Cached Street, Tel Aviv");
    expect(result.current.addressForPublish).toBe("Cached Street, Tel Aviv");
    expect(reverseGeocodeMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(750);
    });
    expect(reverseGeocodeMock).not.toHaveBeenCalled();
  });
});
