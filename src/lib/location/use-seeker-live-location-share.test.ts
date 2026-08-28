import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useSeekerLiveLocationShare } from "@/lib/location/use-seeker-live-location-share";
import { renderHook, act } from "@testing-library/react";

const publishSeekerLiveLocationViaEdge = vi.fn(async () => ({
  ok: true as const,
  accepted: true as const,
}));
const rpc = vi.fn(async () => ({ data: true, error: null }));
const refreshSession = vi.fn(async () => ({
  data: { session: { access_token: "token" } },
}));
const getSession = vi.fn(async () => ({
  data: { session: { access_token: "token" } },
}));
const onAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/lib/location/publish-seeker-live-location", () => ({
  publishSeekerLiveLocationViaEdge: (...args: unknown[]) =>
    publishSeekerLiveLocationViaEdge(...args),
}));

vi.mock("@/lib/location/handoff-location-service", () => ({
  getHandoffLocationService: () => ({
    isNative: false,
    startHandoffTracking: vi.fn(),
    stopHandoffTracking: vi.fn(),
    getTrackingState: vi.fn(async () => ({
      active: false,
      claimId: null,
      source: null,
    })),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc,
    auth: { getSession, refreshSession, onAuthStateChange },
  }),
}));

describe("useSeekerLiveLocationShare lifecycle", () => {
  const clearWatch = vi.fn();
  const watchPosition = vi.fn(() => 42);

  beforeEach(() => {
    vi.clearAllMocks();
    watchPosition.mockReturnValue(42);
    publishSeekerLiveLocationViaEdge.mockResolvedValue({
      ok: true,
      accepted: true,
    });
    rpc.mockResolvedValue({ data: true, error: null });
    getSession.mockImplementation(async () => ({
      data: { session: { access_token: "token" } },
    }));
    refreshSession.mockImplementation(async () => ({
      data: { session: { access_token: "token" } },
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "publishable-key",
    );
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
    vi.unstubAllEnvs();
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

  it("starts watchPosition before awaiting send authorization", async () => {
    const order: string[] = [];
    watchPosition.mockImplementation(() => {
      order.push("watch");
      return 42;
    });
    rpc.mockImplementation(async () => {
      order.push("authorize");
      return { data: true, error: null };
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
    expect(order).toContain("authorize");
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

  it("forceStop best-effort posts stopped status via edge transport", async () => {
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

    expect(publishSeekerLiveLocationViaEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "seeker-location-status",
        payload: expect.objectContaining({ status: "stopped" }),
      }),
    );
    expect(clearWatch).toHaveBeenCalled();
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
    expect(publishSeekerLiveLocationViaEdge).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "seeker-location" }),
    );
  });

  it("switches to sharing only after GPS + successful edge publish", async () => {
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(publishSeekerLiveLocationViaEdge).toHaveBeenCalledWith(
      expect.objectContaining({ event: "seeker-location" }),
    );
    expect(result.current.uiState).toBe("sharing");
  });

  it("does not report sharing from GPS alone before edge publish", async () => {
    publishSeekerLiveLocationViaEdge.mockImplementationOnce(async () => {
      await new Promise(() => {
        // Never resolves — transport still in flight.
      });
      return { ok: true, accepted: true };
    });
    watchPosition.mockImplementation((success: PositionCallback) => {
      queueMicrotask(() => {
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
      });
      return 42;
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId: "11111111-1111-4111-8111-811111111111",
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.uiState).not.toBe("sharing");
    expect(["acquiring", "unavailable"]).toContain(result.current.uiState);
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
    await act(async () => {
      await Promise.resolve();
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
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.uiState).toBe("sharing");
    vi.useRealTimers();
  });

  it("checks can_send_claim_location before sharing on web", async () => {
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

    expect(rpc).toHaveBeenCalledWith("can_send_claim_location", {
      p_topic: "claim-location:11111111-1111-4111-8111-111111111111",
    });
  });

  it("does not use realtime channel.send for web transport", async () => {
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

    expect(publishSeekerLiveLocationViaEdge).not.toHaveBeenCalled();
  });
});
