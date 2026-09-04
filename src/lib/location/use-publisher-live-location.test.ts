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
const rpc = vi.fn(async () => ({ data: true, error: null }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel,
    removeChannel,
    getChannels,
    from,
    rpc,
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
    vi.useRealTimers();
    vi.clearAllMocks();
    resetPublisherLiveLocationCacheForTests();
    subscribeStatus = null;
    locationHandler = null;
    statusHandler = null;
    subscribe.mockImplementation((cb?: (status: string) => void) => {
      subscribeStatus = cb ?? null;
      return { unsubscribe: vi.fn() };
    });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    getSession.mockImplementation(async () => ({
      data: { session: { access_token: "token" } },
    }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("does not subscribe or throw when getSession fails after idle resume", async () => {
    getSession.mockRejectedValue(new Error("Auth session missing"));

    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(getSession).toHaveBeenCalled();
    });

    expect(channel).not.toHaveBeenCalled();
    expect(result.current.location).toBeNull();
    expect(result.current.statusLabel).toBe("Waiting for driver location");
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

  it("checks can_receive_claim_location before subscribing", async () => {
    renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("can_receive_claim_location", {
        p_topic: TOPIC,
      });
    });
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

  it("does not fetch snapshot before SUBSCRIBED", async () => {
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

    renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalled();
    });
    expect(from).not.toHaveBeenCalled();
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

  it("schedules reconnect after unexpected channel closed while subscribed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderHook(() =>
        usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
      );

      await waitFor(() => {
        expect(subscribeStatus).toBeTypeOf("function");
      });

      await act(async () => {
        subscribeStatus?.("SUBSCRIBED");
      });

      const callsBefore = channel.mock.calls.length;
      await act(async () => {
        subscribeStatus?.("CLOSED");
        await vi.advanceTimersByTimeAsync(1_600);
      });

      expect(channel.mock.calls.length).toBeGreaterThan(callsBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers missed pre-SUBSCRIBED broadcast from post-subscribe snapshot", async () => {
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
      expect(subscribe).toHaveBeenCalled();
    });
    expect(result.current.location).toBeNull();
    expect(from).not.toHaveBeenCalled();

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });

    await waitFor(() => {
      expect(result.current.location?.latitude).toBe(32.099);
    });
    expect(from).toHaveBeenCalledWith("claim_live_locations");
  });

  it("does not duplicate subscribe when auth fires during mount", async () => {
    onAuthStateChange.mockImplementation((callback) => {
      queueMicrotask(() => {
        callback("INITIAL_SESSION", { access_token: "token" });
      });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("focus and online during subscribing do not duplicate channel", async () => {
    renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(channel).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("ignores stale CLOSED callback from replaced channel", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const statusCallbacks: Array<(status: string) => void> = [];
    subscribe.mockImplementation((cb?: (status: string) => void) => {
      if (cb) {
        statusCallbacks.push(cb);
        subscribeStatus = cb;
      }
      return { unsubscribe: vi.fn() };
    });

    try {
      const { rerender } = renderHook(
        ({ claimId }: { claimId: string }) =>
          usePublisherLiveLocation({ claimId, enabled: true }),
        { initialProps: { claimId: CLAIM_ID } },
      );

      await waitFor(() => {
        expect(statusCallbacks.length).toBe(1);
      });

      rerender({ claimId: "22222222-2222-4222-8222-222222222222" });

      await waitFor(() => {
        expect(statusCallbacks.length).toBe(2);
      });

      await act(async () => {
        statusCallbacks[1]?.("SUBSCRIBED");
      });

      const channelsBefore = channel.mock.calls.length;
      await act(async () => {
        statusCallbacks[0]?.("CLOSED");
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(channel.mock.calls.length).toBe(channelsBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reconnects once on genuine CHANNEL_ERROR and fetches snapshot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    maybeSingle.mockImplementation(async () => ({
      data:
        maybeSingle.mock.calls.length >= 2
          ? {
              latitude: 32.2,
              longitude: 34.7818,
              accuracy_meters: 12,
              heading_degrees: null,
              sequence: 3,
              location_timestamp: new Date().toISOString(),
            }
          : null,
      error: null,
    }));

    const { result } = renderHook(() =>
      usePublisherLiveLocation({ claimId: CLAIM_ID, enabled: true }),
    );

    await waitFor(() => {
      expect(subscribeStatus).toBeTypeOf("function");
    });

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
    });

    const subscribeCallsBefore = subscribe.mock.calls.length;
    await act(async () => {
      subscribeStatus?.("CHANNEL_ERROR");
      await vi.advanceTimersByTimeAsync(1_600);
    });

    expect(subscribe.mock.calls.length).toBe(subscribeCallsBefore + 1);

    await act(async () => {
      subscribeStatus?.("SUBSCRIBED");
      await Promise.resolve();
    });

    expect(result.current.location?.latitude).toBe(32.2);
  });

  it("claimId change creates exactly one new channel", async () => {
    const { rerender } = renderHook(
      ({ claimId }: { claimId: string }) =>
        usePublisherLiveLocation({ claimId, enabled: true }),
      { initialProps: { claimId: CLAIM_ID } },
    );

    await waitFor(() => {
      expect(channel).toHaveBeenCalledTimes(1);
    });

    rerender({ claimId: "22222222-2222-4222-8222-222222222222" });

    await waitFor(() => {
      expect(channel).toHaveBeenCalledTimes(2);
    });
    expect(removeChannel).toHaveBeenCalled();
  });

  it("disabled hook prevents stale reconnect after terminal cleanup", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          usePublisherLiveLocation({ claimId: CLAIM_ID, enabled }),
        { initialProps: { enabled: true } },
      );

      await act(async () => {
        await Promise.resolve();
        subscribeStatus?.("SUBSCRIBED");
        subscribeStatus?.("CHANNEL_ERROR");
      });

      rerender({ enabled: false });

      const channelsBefore = channel.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(channel.mock.calls.length).toBe(channelsBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});
