import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getHandoffLocationService,
  setHandoffLocationServiceForTests,
  stopHandoffTrackingBestEffort,
} from "@/lib/location/handoff-location-service";

describe("HandoffLocationService", () => {
  afterEach(() => {
    setHandoffLocationServiceForTests(null);
  });

  it("H. web/PWA service does not start native tracking", async () => {
    const service = getHandoffLocationService();
    expect(service.isNative).toBe(false);
    await expect(
      service.startHandoffTracking({
        claimId: "11111111-1111-4111-8111-111111111111",
        expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        accessToken: "token",
        supabaseUrl: "https://example.supabase.co",
        supabasePublishableKey: "pub",
      }),
    ).resolves.toEqual({ ok: true, source: "web" });
    await expect(service.getTrackingState()).resolves.toEqual({
      active: false,
      claimId: null,
      source: null,
    });
  });

  it("F. logout best-effort stops the native tracker", async () => {
    const stopHandoffTracking = vi.fn(async () => undefined);
    setHandoffLocationServiceForTests({
      isNative: true,
      startHandoffTracking: vi.fn(),
      stopHandoffTracking,
      getTrackingState: vi.fn(),
    });
    await stopHandoffTrackingBestEffort("logout");
    expect(stopHandoffTracking).toHaveBeenCalledWith("logout");
  });

  it("native start maps permission denial without throwing", async () => {
    const startHandoffTracking = vi.fn(async () => ({
      started: false,
      reason: "permission_denied",
    }));
    setHandoffLocationServiceForTests({
      isNative: true,
      startHandoffTracking: async (input) => {
        const pluginResult = await startHandoffTracking(input);
        if (!pluginResult.started && pluginResult.reason === "permission_denied") {
          return { ok: false, reason: "permission_denied" };
        }
        return { ok: false, reason: "unavailable" };
      },
      stopHandoffTracking: vi.fn(),
      getTrackingState: vi.fn(async () => ({
        active: false,
        claimId: null,
        source: null,
      })),
    });

    const result = await getHandoffLocationService().startHandoffTracking({
      claimId: "11111111-1111-4111-8111-111111111111",
      expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
      accessToken: "token",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "pub",
    });
    expect(result).toEqual({ ok: false, reason: "permission_denied" });
  });
});
