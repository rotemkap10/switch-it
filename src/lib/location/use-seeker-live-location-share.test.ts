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
    expect(result.current.uiState).toBe("sharing");

    await act(async () => {
      await result.current.stopSharing();
    });

    expect(clearWatch).toHaveBeenCalled();
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
});
