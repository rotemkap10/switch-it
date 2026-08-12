import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useSeekerLiveLocationShare } from "@/lib/location/use-seeker-live-location-share";
import { renderHook, act } from "@testing-library/react";

const removeChannel = vi.fn(async () => "ok");
const send = vi.fn(async () => "ok");
const subscribe = vi.fn((cb?: (status: string) => void) => {
  cb?.("SUBSCRIBED");
  return { unsubscribe: vi.fn() };
});
const on = vi.fn(() => ({ subscribe, on, send }));
const channel = vi.fn(() => ({ on, subscribe, send }));
const setAuth = vi.fn(async () => undefined);
const getSession = vi.fn(async () => ({
  data: { session: { access_token: "token" } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel,
    removeChannel,
    realtime: { setAuth },
    auth: { getSession },
  }),
}));

describe("useSeekerLiveLocationShare lifecycle", () => {
  const clearWatch = vi.fn();
  const watchPosition = vi.fn(() => 42);

  beforeEach(() => {
    vi.clearAllMocks();
    watchPosition.mockReturnValue(42);
    getSession.mockImplementation(async () => ({
      data: { session: { access_token: "token" } },
    }));
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition,
        clearWatch,
      },
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not start watchPosition before deliberate share", () => {
    renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("starts exactly one watch after share and clears on stop", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(result.current.uiState).toBe("acquiring");

    await act(async () => {
      await result.current.stopSharing();
    });

    expect(clearWatch).toHaveBeenCalled();
    expect(result.current.uiState).toBe("off");
  });

  it("starts watchPosition before awaiting the realtime channel", async () => {
    const order: string[] = [];
    watchPosition.mockImplementation(() => {
      order.push("watch");
      return 42;
    });
    getSession.mockImplementation(async () => {
      order.push("session");
      return { data: { session: { access_token: "token" } } };
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(order[0]).toBe("watch");
    expect(order).toContain("session");
  });

  it("marks denied without persisting coordinates", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", {
      setItem,
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    watchPosition.mockImplementation((_success, error) => {
      error?.({ code: 1 } as GeolocationPositionError);
      return 42;
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(result.current.uiState).toBe("denied");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("pauses when hidden and resumes watch in the foreground", async () => {
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });
    expect(result.current.uiState).toBe("acquiring");
    expect(watchPosition).toHaveBeenCalledTimes(1);

    await act(async () => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.uiState).toBe("paused");

    await act(async () => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.uiState).toBe("acquiring");
    expect(watchPosition).toHaveBeenCalledTimes(2);
  });

  it("clears watch on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });
    unmount();
    expect(clearWatch).toHaveBeenCalled();
  });

  it("forceStop best-effort broadcasts stopped then leaves", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    await act(async () => {
      result.current.forceStop();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "seeker-location-status",
        payload: expect.objectContaining({ status: "stopped" }),
      }),
    );
    expect(clearWatch).toHaveBeenCalled();
    expect(removeChannel).toHaveBeenCalled();
  });

  it("stays acquiring until a usable GPS fix arrives", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });
    expect(result.current.uiState).toBe("acquiring");
  });

  it("shows weak signal when accuracy is worse than 150m", async () => {
    watchPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: {
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 180,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
      return 42;
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(result.current.uiState).toBe("weak");
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "seeker-location" }),
    );
  });

  it("switches to sharing after a usable GPS fix", async () => {
    watchPosition.mockImplementation((success: PositionCallback) => {
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
        timestamp: Date.now(),
      } as GeolocationPosition);
      return 42;
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(result.current.uiState).toBe("sharing");
  });

  it("keeps sharing intent and retries after a temporary GPS error", async () => {
    vi.useFakeTimers();
    let errorCb: PositionErrorCallback | null = null;
    let successCb: PositionCallback | null = null;
    let watchCalls = 0;
    watchPosition.mockImplementation((success, error) => {
      watchCalls += 1;
      successCb = success;
      errorCb = error ?? null;
      return 40 + watchCalls;
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });
    expect(watchCalls).toBe(1);

    await act(async () => {
      successCb?.({
        coords: {
          latitude: 32.08,
          longitude: 34.78,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    expect(result.current.uiState).toBe("sharing");

    await act(async () => {
      errorCb?.({
        code: 3,
        message: "timeout",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });
    expect(result.current.uiState).toBe("unavailable");
    expect(removeChannel).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(watchCalls).toBe(2);

    await act(async () => {
      successCb?.({
        coords: {
          latitude: 32.081,
          longitude: 34.781,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    expect(result.current.uiState).toBe("sharing");
    vi.useRealTimers();
  });

  it("subscribes on a private claim-location channel only", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-111111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(channel).toHaveBeenCalledWith(
      "claim-location:11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        config: expect.objectContaining({ private: true }),
      }),
    );
  });
});
