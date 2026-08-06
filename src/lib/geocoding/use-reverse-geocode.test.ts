import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetReverseGeocodeCacheForTests } from "@/lib/geocoding/reverse-geocode-cache";
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

  it("marks map interaction as updating without blocking publish value", () => {
    reverseGeocodeMock.mockResolvedValue({ label: "Stable St, Tel Aviv" });

    const { result } = renderHook(() => useReverseGeocode(32.1, 34.2, true));

    act(() => {
      result.current.notifyMapMoveStart();
    });

    expect(result.current.isUpdating).toBe(true);
  });
});
