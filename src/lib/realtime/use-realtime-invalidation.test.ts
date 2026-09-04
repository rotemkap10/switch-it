import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
const removeChannelMock = vi.fn();
const subscribeMock = vi.fn();
const onMock = vi.fn();
const channelMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: channelMock,
    removeChannel: removeChannelMock,
  }),
}));

import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

describe("useDebouncedRouterRefresh", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces burst scheduleRefresh calls into one router.refresh", () => {
    const { result } = renderHook(() => useDebouncedRouterRefresh(200));

    act(() => {
      result.current();
      result.current();
      result.current();
    });
    expect(refreshMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});

describe("useRealtimeInvalidation", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    removeChannelMock.mockReset();
    subscribeMock.mockReset();
    onMock.mockReset();
    channelMock.mockReset();

    const channel = {
      on: onMock.mockReturnThis(),
      subscribe: subscribeMock.mockReturnThis(),
    };
    onMock.mockReturnValue(channel);
    subscribeMock.mockReturnValue(channel);
    channelMock.mockReturnValue(channel);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("subscribes once with the configured table and filter", () => {
    const onEvent = vi.fn();
    renderHook(() =>
      useRealtimeInvalidation({
        channelName: "map-claim:abc",
        changes: [
          {
            event: "*",
            table: "claims",
            filter: "id=eq.abc",
          },
        ],
        onEvent,
      }),
    );

    expect(channelMock).toHaveBeenCalledWith("map-claim:abc");
    expect(onMock).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "*",
        schema: "public",
        table: "claims",
        filter: "id=eq.abc",
      }),
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  it("invokes onEvent for relevant payloads and cleans up the channel", () => {
    const onEvent = vi.fn();
    let handler: ((payload: unknown) => void) | undefined;
    onMock.mockImplementation((_type, _filter, cb) => {
      handler = cb;
      return {
        on: onMock,
        subscribe: subscribeMock,
      };
    });
    subscribeMock.mockReturnValue({
      on: onMock,
      subscribe: subscribeMock,
    });
    channelMock.mockReturnValue({
      on: onMock,
      subscribe: subscribeMock,
    });

    const { unmount } = renderHook(() =>
      useRealtimeInvalidation({
        channelName: "map-spots:u1",
        changes: [{ event: "*", table: "parking_spots" }],
        onEvent,
      }),
    );

    act(() => {
      handler?.({ eventType: "UPDATE", table: "parking_spots" });
    });
    expect(onEvent).toHaveBeenCalledTimes(1);

    unmount();
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onEvent after unmount and swallows handler throws", () => {
    const onEvent = vi.fn(() => {
      throw new Error("handler exploded");
    });
    let handler: ((payload: unknown) => void) | undefined;
    onMock.mockImplementation((_type, _filter, cb) => {
      handler = cb;
      return {
        on: onMock,
        subscribe: subscribeMock,
      };
    });
    subscribeMock.mockReturnValue({
      on: onMock,
      subscribe: subscribeMock,
    });
    channelMock.mockReturnValue({
      on: onMock,
      subscribe: subscribeMock,
    });

    const { unmount } = renderHook(() =>
      useRealtimeInvalidation({
        channelName: "map-spots:u1",
        changes: [{ event: "*", table: "parking_spots" }],
        onEvent,
      }),
    );

    expect(() => {
      act(() => {
        handler?.({ eventType: "UPDATE", table: "parking_spots" });
      });
    }).not.toThrow();
    expect(onEvent).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      handler?.({ eventType: "UPDATE", table: "parking_spots" });
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when disabled", () => {
    renderHook(() =>
      useRealtimeInvalidation({
        channelName: "idle",
        enabled: false,
        changes: [{ event: "*", table: "claims" }],
        onEvent: vi.fn(),
      }),
    );
    expect(channelMock).not.toHaveBeenCalled();
  });

  it("does not leave duplicate channels under Strict Mode remount", () => {
    const { unmount } = renderHook(() =>
      useRealtimeInvalidation({
        channelName: "map-spots:u1",
        changes: [{ event: "*", table: "parking_spots" }],
        onEvent: vi.fn(),
      }),
    );
    expect(channelMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(removeChannelMock).toHaveBeenCalledTimes(1);

    renderHook(() =>
      useRealtimeInvalidation({
        channelName: "map-spots:u1",
        changes: [{ event: "*", table: "parking_spots" }],
        onEvent: vi.fn(),
      }),
    );
    expect(channelMock).toHaveBeenCalledTimes(2);
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });
});
