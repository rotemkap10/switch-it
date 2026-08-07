import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

import {
  INITIAL_HANDOFF_GRACE_MINUTES,
  MAX_HANDOFF_WINDOW_MINUTES,
  HANDOFF_EXTENSION_MINUTES,
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

  it("publishes with initial grace of 2 minutes and hard cap of 5", () => {
    expect(INITIAL_HANDOFF_GRACE_MINUTES).toBe(2);
    expect(MAX_HANDOFF_WINDOW_MINUTES).toBe(5);
    expect(HANDOFF_EXTENSION_MINUTES).toBe(2);

    const window = computeSpotAvailabilityWindow(10);
    expect(window.available_at).toBe("2026-08-03T12:10:00.000Z");
    expect(window.expires_at).toBe("2026-08-03T12:12:00.000Z");
    expect(handoffHardCapMs(window.available_at)).toBe(
      Date.parse("2026-08-03T12:15:00.000Z"),
    );
  });

  it("does not shorten a legacy +5-minute expires_at when computing headroom", () => {
    const available = "2026-08-03T12:10:00.000Z";
    const legacyExpires = "2026-08-03T12:15:00.000Z";
    expect(availableExtensionMs(available, legacyExpires)).toBe(0);
    expect(formatHandoffExtensionButtonLabel(available, legacyExpires)).toBeNull();
  });

  it("offers +2 then +1 then nothing toward the hard cap", () => {
    const available = "2026-08-03T12:10:00.000Z";
    const initial = "2026-08-03T12:12:00.000Z";
    const afterFirst = "2026-08-03T12:14:00.000Z";
    const atCap = "2026-08-03T12:15:00.000Z";

    expect(availableExtensionMs(available, initial)).toBe(2 * 60_000);
    expect(formatHandoffExtensionButtonLabel(available, initial)).toBe(
      "Wait 2 more min",
    );

    expect(availableExtensionMs(available, afterFirst)).toBe(60_000);
    expect(formatHandoffExtensionButtonLabel(available, afterFirst)).toBe(
      "Wait 1 more min",
    );

    expect(availableExtensionMs(available, atCap)).toBe(0);
    expect(formatHandoffExtensionButtonLabel(available, atCap)).toBeNull();
  });

  it("uses truthful partial copy when headroom is not a whole minute", () => {
    const available = "2026-08-03T12:10:00.000Z";
    const expires = "2026-08-03T12:14:30.000Z";
    expect(availableExtensionMs(available, expires)).toBe(30_000);
    expect(formatHandoffExtensionButtonLabel(available, expires)).toBe(
      "Wait 0:30 more",
    );
  });

  it("only offers extension during the claimed window before the current deadline", () => {
    const available = "2026-08-03T12:10:00.000Z";
    const expires = "2026-08-03T12:12:00.000Z";

    expect(
      canOfferHandoffExtension({
        availableAtIso: available,
        expiresAtIso: expires,
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:09:00.000Z"),
      }),
    ).toBe(false);

    expect(
      canOfferHandoffExtension({
        availableAtIso: available,
        expiresAtIso: expires,
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:11:00.000Z"),
      }),
    ).toBe(true);

    expect(
      canOfferHandoffExtension({
        availableAtIso: available,
        expiresAtIso: expires,
        claimed: true,
        nowMs: Date.parse("2026-08-03T12:12:00.000Z"),
      }),
    ).toBe(false);

    expect(
      canOfferHandoffExtension({
        availableAtIso: available,
        expiresAtIso: expires,
        claimed: false,
        nowMs: Date.parse("2026-08-03T12:11:00.000Z"),
      }),
    ).toBe(false);
  });
});
