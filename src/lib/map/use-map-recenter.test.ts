import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMapRecenter } from "@/lib/map/use-map-recenter";
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

describe("useMapRecenter", () => {
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

  it("recenters immediately from a fresh shared fix", async () => {
    acquireSharedForegroundLocation("find-parking");
    const current = {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 10,
      timestamp: Date.now(),
    };
    onUpdate?.(current);

    const onFix = vi.fn();
    const { result } = renderHook(() => useMapRecenter({ onFix }));

    await act(async () => {
      const pending = result.current.recenter();
      await vi.advanceTimersByTimeAsync(2_500);
      await pending;
    });

    expect(onFix).toHaveBeenCalledWith(current);
  });

  it("ignores duplicate clicks while a recenter is pending", async () => {
    const onFix = vi.fn();
    const { result } = renderHook(() => useMapRecenter({ onFix }));

    let resolveFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const firstPromise = act(async () => {
      const pending = result.current.recenter();
      resolveFirst();
      await vi.advanceTimersByTimeAsync(12_000);
      await pending;
    });

    await firstStarted;
    await act(async () => {
      await result.current.recenter();
    });

    await firstPromise;
    expect(onFix).not.toHaveBeenCalled();
  });

  it("reports errors when shared location never becomes trusted", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useMapRecenter({ onError }));

    await act(async () => {
      const pending = result.current.recenter();
      await vi.advanceTimersByTimeAsync(12_000);
      await pending;
    });

    expect(onError).toHaveBeenCalledWith("timeout");
  });
});
