import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LIVE_LOCATION_PAUSE_WHILE_NAVIGATING,
} from "@/lib/location/stale";
import {
  resetPublisherLiveLocationCacheForTests,
  usePublisherLiveLocation,
} from "@/lib/location/use-publisher-live-location";

const CLAIM_ID = "11111111-1111-4111-8111-111111111111";
const TOPIC = `claim-location:${CLAIM_ID}`;

type BroadcastHandler = (message: { payload: unknown }) => void;

let subscribeStatus: ((status: string) => void) | null = null;
let locationHandler: BroadcastHandler | null = null;
let statusHandler: BroadcastHandler | null = null;

const removeChannel = vi.fn(async () => "ok");
const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const subscribe = vi.fn((cb?: (status: string) => void) => {
  subscribeStatus = cb ?? null;
  return { unsubscribe: vi.fn() };
});
const on = vi.fn(
  (
    _type: string,
    filter: { event: string },
    handler: BroadcastHandler,
  ) => {
    if (filter.event === "seeker-location") {
      locationHandler = handler;
    }
    if (filter.event === "seeker-location-status") {
      statusHandler = handler;
    }
    return { on, subscribe };
  },
);
const channel = vi.fn(() => ({ on, subscribe }));
const setAuth = vi.fn(async () => undefined);
const getChannels = vi.fn(() => []);
const getSession = vi.fn(async () => ({
  data: { session: { access_token: "token" } },
}));
const onAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel,
    removeChannel,
    getChannels,
    from,
    realtime: { setAuth },
    auth: { getSession, onAuthStateChange },
  }),
}));

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    latitude: 32.0853,
    longitude: 34.7818,
    accuracyMeters: 12,
    headingDegrees: null,
    sequence: 1,
    sentAt: Date.now(),
    ...overrides,
  };
}

describe("usePublisherLiveLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPublisherLiveLocationCacheForTests();
    subscribeStatus = null;
    locationHandler = null;
    statusHandler = null;
    maybeSingle.mockResolvedValue({ data: null, error: null });
    getSession.mockImplementation(async () => ({
      data: { session: { access_token: "token" } },
    }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("subscribes to the correct claim topic", async () => {
    renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(channel).toHaveBeenCalledWith(
        TOPIC,
        expect.objectContaining({
          config: expect.objectContaining({ private: true }),
        }),
      );
    });
    expect(subscribe).toHaveBeenCalled();
  });

  it("stays on Waiting for driver location until the first payload", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalled();
    });

    expect(result.current.statusLabel).toBe("Waiting for driver location");
    expect(result.current.location).toBeNull();

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });
    expect(result.current.statusLabel).toBe("Waiting for driver location");
    expect(result.current.location).toBeNull();
  });

  it("updates the live marker on subsequent broadcasts", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
      locationHandler?.({ payload: validPayload() });
    });

    expect(result.current.freshness).toBe("live");
    expect(result.current.statusLabel).toBe("Live location");
    expect(result.current.updatedLabel).toBe("Updated just now");
    expect(result.current.location?.latitude).toBe(32.0853);
    expect(result.current.pauseHint).toBeNull();

    await act(async () => {
      locationHandler?.({
        payload: validPayload({ sequence: 2, latitude: 32.091 }),
      });
    });
    expect(result.current.location?.latitude).toBe(32.091);
    expect(result.current.statusLabel).toBe("Live location");
  });

  it("ignores older sequence numbers", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
    });

    await act(async () => {
      locationHandler?.({
        payload: validPayload({ sequence: 2, latitude: 32.09 }),
      });
      locationHandler?.({
        payload: validPayload({ sequence: 1, latitude: 32.01 }),
      });
    });

    expect(result.current.location?.latitude).toBe(32.09);
    expect(result.current.location?.sequence).toBe(2);
  });

  it("handles explicit paused state without clearing the last marker", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
      expect(statusHandler).toBeTypeOf("function");
    });

    await act(async () => {
      locationHandler?.({ payload: validPayload({ sequence: 1 }) });
      statusHandler?.({
        payload: {
          status: "paused",
          sequence: 2,
          sentAt: Date.now(),
        },
      });
    });

    expect(result.current.freshness).toBe("delayed");
    expect(result.current.statusLabel).toBe("Location update delayed");
    expect(result.current.pauseHint).toBe(LIVE_LOCATION_PAUSE_WHILE_NAVIGATING);
    expect(result.current.location?.latitude).toBe(32.0853);
  });

  it("ages freshness from live to delayed to paused", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
      );

      await waitFor(() => {
        expect(locationHandler).toBeTypeOf("function");
      });

      await act(async () => {
        locationHandler?.({ payload: validPayload({ sequence: 1 }) });
      });
      expect(result.current.freshness).toBe("live");

      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });
      expect(result.current.freshness).toBe("delayed");
      expect(result.current.statusLabel).toBe("Location update delayed");
      expect(result.current.updatedLabel).toMatch(/Updated \d+ seconds ago/);
      expect(result.current.location).not.toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      expect(result.current.freshness).toBe("paused");
      expect(result.current.statusLabel).toBe("Location update delayed");
      expect(result.current.updatedLabel).toMatch(/Last update \d+ seconds ago/);
      expect(result.current.location).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles CHANNEL_ERROR / TIMED_OUT / CLOSED without dropping the last marker", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
      expect(subscribeStatus).toBeTypeOf("function");
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
      locationHandler?.({ payload: validPayload({ sequence: 1 }) });
    });
    expect(result.current.freshness).toBe("live");

    await act(async () => {
      subscribeStatus?.("CHANNEL_ERROR");
    });
    expect(result.current.freshness).toBe("delayed");
    expect(result.current.statusLabel).toBe("Location update delayed");
    expect(result.current.location?.latitude).toBe(32.0853);

    await act(async () => {
      subscribeStatus?.("TIMED_OUT");
    });
    expect(result.current.freshness).toBe("delayed");

    await act(async () => {
      subscribeStatus?.("CLOSED");
    });
    expect(result.current.freshness).toBe("delayed");

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });
    expect(result.current.freshness).toBe("live");
    expect(result.current.statusLabel).toBe("Live location");
    expect(result.current.location?.latitude).toBe(32.0853);
  });

  it("accepts nested broadcast envelopes", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
    });

    await act(async () => {
      locationHandler?.({
        payload: {
          type: "broadcast",
          event: "seeker-location",
          payload: validPayload({ sequence: 3, latitude: 32.1 }),
        },
      });
    });

    expect(result.current.location?.latitude).toBe(32.1);
    expect(result.current.statusLabel).toBe("Live location");
  });

  it("subscribes using claimId, not spotId", async () => {
    const spotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(channel).toHaveBeenCalledWith(
        TOPIC,
        expect.anything(),
      );
    });
    expect(channel).not.toHaveBeenCalledWith(
      expect.stringContaining(spotId),
      expect.anything(),
    );
  });

  it("keeps last known location when a later payload is delayed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() =>
        usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
      );
      await waitFor(() => {
        expect(locationHandler).toBeTypeOf("function");
      });
      await act(async () => {
        locationHandler?.({ payload: validPayload({ sequence: 1 }) });
      });
      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });
      expect(result.current.statusLabel).toBe("Location update delayed");
      expect(result.current.location?.latitude).toBe(32.0853);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleans up the channel on unmount and claim change", async () => {
    const { rerender, unmount } = renderHook(
      ({ claimId }: { claimId: string }) =>
        usePublisherLiveLocation({ claimId, enabled: true }),
      { initialProps: { claimId: CLAIM_ID } },
    );

    await waitFor(() => {
      expect(channel).toHaveBeenCalledTimes(1);
    });

    rerender({ claimId: "22222222-2222-4222-8222-222222222222" });
    await waitFor(() => {
      expect(removeChannel).toHaveBeenCalled();
      expect(channel).toHaveBeenCalledWith(
        "claim-location:22222222-2222-4222-8222-222222222222",
        expect.anything(),
      );
    });

    unmount();
    expect(removeChannel.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows car from latest snapshot when first broadcast was missed", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        latitude: 32.099,
        longitude: 34.7818,
        accuracy_meters: 12,
        heading_degrees: null,
        sequence: 1,
        location_timestamp: new Date().toISOString(),
      },
      error: null,
    });

    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribeStatus).toBeTypeOf("function");
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });

    await waitFor(() => {
      expect(result.current.location?.latitude).toBe(32.099);
    });
    expect(result.current.statusLabel).toBe("Live location");
    expect(from).toHaveBeenCalledWith("claim_live_locations");
  });

  it("does not overwrite newer broadcast with older snapshot", async () => {
    maybeSingle.mockImplementation(
      () =>
        new Promise((resolve) => {
          window.setTimeout(() => {
            resolve({
              data: {
                latitude: 32.01,
                longitude: 34.7818,
                accuracy_meters: 12,
                heading_degrees: null,
                sequence: 1,
                location_timestamp: new Date(Date.now() - 60_000).toISOString(),
              },
              error: null,
            });
          }, 50);
        }),
    );

    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
      locationHandler?.({
        payload: validPayload({ sequence: 2, latitude: 32.091 }),
      });
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    });

    expect(result.current.location?.latitude).toBe(32.091);
    expect(result.current.location?.sequence).toBe(2);
  });

  it("re-fetches snapshot on reconnect SUBSCRIBED", async () => {
    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribeStatus).toBeTypeOf("function");
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });
    await waitFor(() => {
      expect(from).toHaveBeenCalled();
    });
    const fetchesAfterFirstSubscribe = from.mock.calls.length;

    maybeSingle.mockResolvedValue({
      data: {
        latitude: 32.2,
        longitude: 34.7818,
        accuracy_meters: 12,
        heading_degrees: null,
        sequence: 5,
        location_timestamp: new Date().toISOString(),
      },
      error: null,
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });

    await waitFor(() => {
      expect(from.mock.calls.length).toBeGreaterThan(fetchesAfterFirstSubscribe);
      expect(result.current.location?.latitude).toBe(32.2);
    });
  });

  it("keeps delayed status after snapshot exists instead of waiting copy", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      maybeSingle.mockResolvedValue({
        data: {
          latitude: 32.0853,
          longitude: 34.7818,
          accuracy_meters: 12,
          heading_degrees: null,
          sequence: 1,
          location_timestamp: new Date().toISOString(),
        },
        error: null,
      });

      const { result } = renderHook(() =>
        usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
      );

      await waitFor(() => {
        expect(subscribeStatus).toBeTypeOf("function");
      });

      await act(async () => {
        subscribeStatus?.("SUBSCRIBED");
      });

      await waitFor(() => {
        expect(result.current.location).not.toBeNull();
      });

      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });

      expect(result.current.statusLabel).toBe("Location update delayed");
      expect(result.current.statusLabel).not.toBe("Waiting for driver location");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetches the latest snapshot on mount without waiting for SUBSCRIBED", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        latitude: 32.099,
        longitude: 34.7818,
        accuracy_meters: 12,
        heading_degrees: null,
        sequence: 1,
        location_timestamp: new Date().toISOString(),
      },
      error: null,
    });

    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.location?.latitude).toBe(32.099);
    });
    expect(from).toHaveBeenCalledWith("claim_live_locations");
  });

  it("restores the last known live location immediately after remount", async () => {
    const { result, unmount } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(locationHandler).toBeTypeOf("function");
    });

    await act(async () => {
      locationHandler?.({ payload: validPayload({ sequence: 4, latitude: 32.15 }) });
    });
    expect(result.current.location?.latitude).toBe(32.15);

    unmount();

    const remounted = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    expect(remounted.result.current.location?.latitude).toBe(32.15);
    expect(remounted.result.current.location?.sequence).toBe(4);
  });

  it("schedules reconnect after channel closed", async () => {
    vi.useFakeTimers();
    try {
      renderHook(() =>
        usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(subscribeStatus).toBeTypeOf("function");

      const callsBefore = channel.mock.calls.length;
      act(() => {
        subscribeStatus?.("CLOSED");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_600);
        await Promise.resolve();
      });

      expect(channel.mock.calls.length).toBeGreaterThan(callsBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});
