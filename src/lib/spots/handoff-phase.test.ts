import { describe, expect, it } from "vitest";

import {
  hasHandoffStarted,
  remainingMsUntil,
  resolveHandoffTimingPhase,
} from "@/lib/spots/handoff-phase";

describe("handoff timing phase", () => {
  const available = "2026-08-04T13:05:00.000Z";
  const confirmDeadline = "2026-08-04T13:08:00.000Z";

  it("treats a missing start as not started", () => {
    expect(hasHandoffStarted(null)).toBe(false);
    expect(hasHandoffStarted(undefined)).toBe(false);
    expect(hasHandoffStarted("2026-08-04T13:03:00.000Z")).toBe(true);
  });

  it("is scheduled before the estimate when the publisher has not started", () => {
    expect(
      resolveHandoffTimingPhase({
        availableAtIso: available,
        expiresAtIso: confirmDeadline,
        handoffStartedAtIso: null,
        nowMs: Date.parse("2026-08-04T13:01:00.000Z"),
      }),
    ).toBe("scheduled");
  });

  it("is confirm after the estimate until the lateness deadline", () => {
    expect(
      resolveHandoffTimingPhase({
        availableAtIso: available,
        expiresAtIso: confirmDeadline,
        handoffStartedAtIso: null,
        nowMs: Date.parse("2026-08-04T13:06:00.000Z"),
      }),
    ).toBe("confirm");
  });

  it("is active once I'm leaving now has been pressed", () => {
    expect(
      resolveHandoffTimingPhase({
        availableAtIso: available,
        expiresAtIso: "2026-08-04T13:09:00.000Z",
        handoffStartedAtIso: "2026-08-04T13:06:00.000Z",
        nowMs: Date.parse("2026-08-04T13:04:00.000Z"),
      }),
    ).toBe("active");
  });

  it("is ended at the authoritative deadline even if start is missing", () => {
    expect(
      resolveHandoffTimingPhase({
        availableAtIso: available,
        expiresAtIso: confirmDeadline,
        handoffStartedAtIso: null,
        nowMs: Date.parse("2026-08-04T13:08:00.000Z"),
      }),
    ).toBe("ended");
  });

  it("measures remaining time until a target", () => {
    expect(
      remainingMsUntil(
        "2026-08-04T13:05:00.000Z",
        Date.parse("2026-08-04T13:01:00.000Z"),
      ),
    ).toBe(4 * 60_000);
  });
});
