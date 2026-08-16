import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startHandoffTracking = vi.fn();
const stopHandoffTracking = vi.fn();
const getTrackingState = vi.fn();

vi.mock("@/lib/location/handoff-location-service", () => ({
  getHandoffLocationService: () => ({
    isNative: true,
    startHandoffTracking,
    stopHandoffTracking,
    getTrackingState,
  }),
  stopHandoffTrackingBestEffort: () => stopHandoffTracking("logout"),
  setHandoffLocationServiceForTests: vi.fn(),
}));

vi.mock("@/lib/location/native-handoff-plugin", () => ({
  getNativeHandoffPlugin: async () => null,
}));

const refreshSession = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { refreshSession, getSession },
    channel: vi.fn(),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn() },
  }),
}));

import { useSeekerLiveLocationShare } from "@/lib/location/use-seeker-live-location-share";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("native seeker live location share", () => {
  const watchPosition = vi.fn(() => 42);
  const clearWatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub";
    getTrackingState.mockResolvedValue({
      active: false,
      claimId: null,
      source: null,
    });
    startHandoffTracking.mockResolvedValue({ ok: true, source: "native" });
    stopHandoffTracking.mockResolvedValue(undefined);
    refreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null,
    });
    getSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
    });
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch },
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("A. starts exactly one native tracker and does not start watchPosition", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(startHandoffTracking).toHaveBeenCalledTimes(1);
    expect(startHandoffTracking).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId,
        accessToken: "fresh-token",
        supabaseUrl: "https://example.supabase.co",
      }),
    );
    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current.uiState).toBe("acquiring");
  });

  it("B. does not pause or stop when the app is hidden (Waze foreground)", async () => {
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    await act(async () => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.uiState).not.toBe("paused");
    expect(stopHandoffTracking).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("D. forceStop stops the native tracker", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
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

    expect(stopHandoffTracking).toHaveBeenCalledWith("terminal");
  });

  it("G. remount of the same active claim does not start a second tracker", async () => {
    getTrackingState.mockResolvedValue({
      active: true,
      claimId,
      source: "native",
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.uiState).toBe("acquiring");
    });
    expect(startHandoffTracking).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.startSharing();
    });

    expect(startHandoffTracking).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current.uiState).toBe("acquiring");
  });

  it("J. permission denial leaves claim/navigation usable (share unavailable only)", async () => {
    startHandoffTracking.mockResolvedValue({
      ok: false,
      reason: "permission_denied",
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(result.current.uiState).toBe("denied");
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("L. native start failure does not crash or persist a route", async () => {
    startHandoffTracking.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(result.current.uiState).toBe("unavailable");
    expect(window.localStorage?.length ?? 0).toBe(0);
  });

  it("does not require a navigation provider to start native sharing", async () => {
    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startSharing();
    });

    expect(startHandoffTracking).toHaveBeenCalledTimes(1);
    expect(startHandoffTracking.mock.calls[0]?.[0]).not.toHaveProperty(
      "navigationProvider",
    );
  });

  it("does not stop native tracking when this instance does not manage the plugin", async () => {
    getTrackingState.mockResolvedValue({
      active: true,
      claimId,
      source: "native",
    });

    renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: false,
        manageNativeTracker: false,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stopHandoffTracking).not.toHaveBeenCalled();
  });

  it("does not stop native tracking when forceStop runs on a non-managing instance", async () => {
    getTrackingState.mockResolvedValue({
      active: true,
      claimId,
      source: "native",
    });

    const { result } = renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: false,
        manageNativeTracker: false,
      }),
    );

    await act(async () => {
      result.current.forceStop();
      await Promise.resolve();
    });

    expect(stopHandoffTracking).not.toHaveBeenCalled();
  });

  it("stops native tracking when a managing instance is disabled", async () => {
    getTrackingState.mockResolvedValue({
      active: true,
      claimId,
      source: "native",
    });

    renderHook(() =>
      useSeekerLiveLocationShare({
        claimId,
        spotExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        enabled: false,
      }),
    );

    await waitFor(() => {
      expect(stopHandoffTracking).toHaveBeenCalled();
    });
  });
});
