import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleRefreshMock = vi.fn();
const onEventRef = vi.hoisted(() => ({
  current: null as null | ((payload: unknown) => void),
}));
const onStatusRef = vi.hoisted(() => ({
  current: null as null | ((status: string) => void),
}));

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefreshMock,
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: (options: {
    onEvent: (payload: unknown) => void;
    onSubscriptionStatus?: (status: string) => void;
  }) => {
    onEventRef.current = options.onEvent;
    onStatusRef.current = options.onSubscriptionStatus ?? null;
  },
}));

import { requestDiscoverySpotTombstone } from "@/lib/map/discovery-spot-tombstone-bus";
import { useSeekerDiscoverySpots } from "@/lib/map/use-seeker-discovery-spots";
import type { MapSpot } from "@/types/map-spot";

const spot: MapSpot = {
  id: "spot-a",
  latitude: 32.1,
  longitude: 34.8,
  address: "A",
  available_at: "2026-08-16T11:55:00.000Z",
  expires_at: "2099-08-16T12:30:00.000Z",
  canClaim: true,
};

describe("useSeekerDiscoverySpots", () => {
  const initialSpots = [spot];

  beforeEach(() => {
    scheduleRefreshMock.mockReset();
    onEventRef.current = null;
    onStatusRef.current = null;
  });

  it("removes a cancelled spot from local state via realtime UPDATE", () => {
    const { result } = renderHook(() =>
      useSeekerDiscoverySpots({
        serverSpots: initialSpots,
        userId: "seeker-1",
      }),
    );

    expect(result.current).toHaveLength(1);

    act(() => {
      onEventRef.current?.({
        eventType: "UPDATE",
        new: {
          id: "spot-a",
          status: "cancelled",
          latitude: 32.1,
          longitude: 34.8,
          address: "A",
          available_at: spot.available_at,
          expires_at: spot.expires_at,
          owner_id: "owner-1",
        },
        old: {},
      });
    });

    expect(result.current).toEqual([]);
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("blocks stale server props from resurrecting a tombstoned spot", () => {
    const { result, rerender } = renderHook(
      ({ serverSpots }) =>
        useSeekerDiscoverySpots({
          serverSpots,
          userId: "seeker-1",
        }),
      { initialProps: { serverSpots: [spot] } },
    );

    act(() => {
      onEventRef.current?.({
        eventType: "UPDATE",
        new: {
          id: "spot-a",
          status: "cancelled",
          latitude: 32.1,
          longitude: 34.8,
          available_at: spot.available_at,
          expires_at: spot.expires_at,
          owner_id: "owner-1",
        },
        old: {},
      });
    });

    expect(result.current).toEqual([]);

    rerender({ serverSpots: [spot] });
    expect(result.current).toEqual([]);
  });

  it("reconciles on realtime reconnect", () => {
    renderHook(() =>
      useSeekerDiscoverySpots({
        serverSpots: initialSpots,
        userId: "seeker-1",
      }),
    );

    act(() => {
      onStatusRef.current?.("SUBSCRIBED");
    });
    scheduleRefreshMock.mockClear();

    act(() => {
      onStatusRef.current?.("SUBSCRIBED");
    });
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("tombstones from failed claim bus", () => {
    const { result } = renderHook(() =>
      useSeekerDiscoverySpots({
        serverSpots: initialSpots,
        userId: "seeker-1",
      }),
    );

    act(() => {
      requestDiscoverySpotTombstone("spot-a");
    });

    expect(result.current).toEqual([]);
  });

  it("hides a listing this seeker released even after it becomes available again", () => {
    const { result } = renderHook(() =>
      useSeekerDiscoverySpots({
        serverSpots: initialSpots,
        userId: "seeker-1",
        releasedSpotIds: ["spot-a"],
      }),
    );
    expect(result.current).toEqual([]);
  });

  it("re-adds a claimed listing when Realtime says it is available again", () => {
    const { result } = renderHook(() =>
      useSeekerDiscoverySpots({
        serverSpots: initialSpots,
        userId: "seeker-c",
      }),
    );

    act(() => {
      onEventRef.current?.({
        eventType: "UPDATE",
        new: {
          id: "spot-a",
          status: "claimed",
          latitude: 32.1,
          longitude: 34.8,
          address: "A",
          available_at: spot.available_at,
          expires_at: spot.expires_at,
          owner_id: "owner-1",
        },
        old: {},
      });
    });
    expect(result.current).toEqual([]);

    act(() => {
      onEventRef.current?.({
        eventType: "UPDATE",
        new: {
          id: "spot-a",
          status: "available",
          latitude: 32.1,
          longitude: 34.8,
          address: "A",
          available_at: spot.available_at,
          expires_at: spot.expires_at,
          owner_id: "owner-1",
        },
        old: {},
      });
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.id).toBe("spot-a");
  });
});
