import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

import {
  INITIAL_HANDOFF_WINDOW_MINUTES,
  INITIAL_HANDOFF_GRACE_MINUTES,
  MAX_HANDOFF_WINDOW_MINUTES,
  HANDOFF_EXTENSION_MINUTES,
  DEPARTURE_LATENESS_MINUTES,
  availableExtensionMs,
  canOfferHandoffExtension,
  computeSpotAvailabilityWindow,
  formatHandoffExtensionButtonLabel,
  handoffHardCapMs,
} from "@/lib/spots/constants";

describe("handoff waiting constants", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts Now and a 10-minute estimate", () => {
    expect(computeSpotAvailabilityWindow(0).available_at).toBe(
      "2026-08-03T12:00:00.000Z",
    );
    expect(computeSpotAvailabilityWindow(10).available_at).toBe(
      "2026-08-03T12:10:00.000Z",
    );
  });

  it("rejects a delay above 10 minutes", () => {
    expect(() => computeSpotAvailabilityWindow(11)).toThrow("INVALID_LEAVE_DELAY");
  });

  it("starts the live handoff immediately when publishing Now", () => {
    const window = computeSpotAvailabilityWindow(0);
    expect(window.handoff_started_at).toBe("2026-08-03T12:00:00.000Z");
    expect(window.expires_at).toBe("2026-08-03T12:03:00.000Z");
    expect(INITIAL_HANDOFF_WINDOW_MINUTES).toBe(3);
    expect(INITIAL_HANDOFF_GRACE_MINUTES).toBe(3);
  });

  it("does not start the live handoff for a future estimate", () => {
    const window = computeSpotAvailabilityWindow(10);
    expect(window.available_at).toBe("2026-08-03T12:10:00.000Z");
    expect(window.handoff_started_at).toBeNull();
    expect(window.expires_at).toBe("2026-08-03T12:13:00.000Z");
    expect(DEPARTURE_LATENESS_MINUTES).toBe(3);
  });

  it("caps the live window from the actual start, not the estimate", () => {
    const started = "2026-08-03T12:06:00.000Z";
    expect(handoffHardCapMs(started)).toBe(
      Date.parse("2026-08-03T12:11:00.000Z"),
    );
    expect(MAX_HANDOFF_WINDOW_MINUTES).toBe(5);
    expect(HANDOFF_EXTENSION_MINUTES).toBe(2);
  });

  it("does not shorten a legacy live deadline already at the hard cap", () => {
    const started = "2026-08-03T12:10:00.000Z";
    const legacyExpires = "2026-08-03T12:15:00.000Z";
    expect(availableExtensionMs(started, legacyExpires)).toBe(0);
    expect(formatHandoffExtensionButtonLabel(started, legacyExpires)).toBeNull();
  });

  it("offers exactly +2 minutes toward the 5-minute hard cap", () => {
    const started = "2026-08-03T12:10:00.000Z";
    const initial = "2026-08-03T12:13:00.000Z";
    const atCap = "2026-08-03T12:15:00.000Z";

    expect(availableExtensionMs(started, initial)).toBe(2 * 60_000);
    expect(formatHandoffExtensionButtonLabel(started, initial)).toBe(
      "Wait 2 more min",
    );
    expect(availableExtensionMs(started, atCap)).toBe(0);
    expect(formatHandoffExtensionButtonLabel(started, atCap)).toBeNull();
  });

  it("uses truthful partial copy when headroom is not a whole minute", () => {
    const started = "2026-08-03T12:10:00.000Z";
    const expires = "2026-08-03T12:14:30.000Z";
    expect(availableExtensionMs(started, expires)).toBe(30_000);
    expect(formatHandoffExtensionButtonLabel(started, expires)).toBe(
      "Wait 0:30 more",
    );
  });

  it("only offers extension after the actual start, once, while claimed", () => {
    const started = "2026-08-03T12:10:00.000Z";
    const expires = "2026-08-03T12:13:00.000Z";

    expect(
      canOfferHandoffExtension({
        handoffStartedAtIso: null,
        expiresAtIso: expires,
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:11:00.000Z"),
      }),
    ).toBe(false);

    expect(
      canOfferHandoffExtension({
        handoffStartedAtIso: started,
        expiresAtIso: expires,
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:11:00.000Z"),
      }),
    ).toBe(true);

    expect(
      canOfferHandoffExtension({
        handoffStartedAtIso: started,
        extensionUsedAtIso: "2026-08-03T12:12:00.000Z",
        expiresAtIso: "2026-08-03T12:15:00.000Z",
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:13:00.000Z"),
      }),
    ).toBe(false);

    expect(
      canOfferHandoffExtension({
        handoffStartedAtIso: started,
        expiresAtIso: expires,
        claimed: false,
        nowMs: Date.parse("2026-08-03T12:11:00.000Z"),
      }),
    ).toBe(false);

    expect(
      canOfferHandoffExtension({
        handoffStartedAtIso: started,
        expiresAtIso: expires,
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:13:00.000Z"),
      }),
    ).toBe(false);
  });
});
