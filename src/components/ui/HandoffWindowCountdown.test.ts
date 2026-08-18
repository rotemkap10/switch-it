import { describe, expect, it } from "vitest";

import {
  formatHandoffClock,
  formatWaitingMinutes,
  getHandoffPhase,
  handoffConfirmCopy,
  handoffSeekerWindowCopy,
  handoffWaitingCopy,
  handoffWindowCopy,
} from "@/components/ui/HandoffWindowCountdown";

describe("getHandoffPhase", () => {
  const available = "2026-08-04T12:10:00.000Z";
  const confirmDeadline = "2026-08-04T12:13:00.000Z";
  const liveDeadline = "2026-08-04T12:13:00.000Z";

  it("is scheduled before available_at when the handoff has not started", () => {
    expect(
      getHandoffPhase(
        available,
        confirmDeadline,
        Date.parse("2026-08-04T12:05:00.000Z"),
      ),
    ).toBe("scheduled");
  });

  it("is confirm between available_at and the lateness deadline", () => {
    expect(
      getHandoffPhase(
        available,
        confirmDeadline,
        Date.parse("2026-08-04T12:11:00.000Z"),
      ),
    ).toBe("confirm");
  });

  it("is active after I'm leaving now, even before the original estimate", () => {
    expect(
      getHandoffPhase(
        available,
        liveDeadline,
        Date.parse("2026-08-04T12:08:00.000Z"),
        "2026-08-04T12:07:00.000Z",
      ),
    ).toBe("active");
  });

  it("is ended at or after expires_at", () => {
    expect(
      getHandoffPhase(
        available,
        confirmDeadline,
        Date.parse("2026-08-04T12:13:00.000Z"),
      ),
    ).toBe("ended");
  });

  it("returns to active when expiresAt is extended past a previous end", () => {
    const extended = "2026-08-04T12:15:00.000Z";
    expect(
      getHandoffPhase(
        available,
        extended,
        Date.parse("2026-08-04T12:13:30.000Z"),
        "2026-08-04T12:10:00.000Z",
      ),
    ).toBe("active");
  });
});

describe("handoff countdown copy", () => {
  it("shows estimated departure remaining before start", () => {
    expect(handoffWaitingCopy("publisher", 4)).toBe("Leaving in 4 min");
    expect(handoffWaitingCopy("seeker", 4)).toBe("Ready in 4 min");
    expect(formatWaitingMinutes(3 * 60_000 + 1)).toBe(4);
  });

  it("shows a confirmation countdown after the estimate", () => {
    expect(handoffConfirmCopy("publisher", "2:14")).toBe("Start within 2:14");
    expect(handoffConfirmCopy("seeker", "2:14")).toBe(
      "Waiting for departure confirmation · 2:14",
    );
  });

  it("shows the live handoff countdown after I'm leaving now", () => {
    expect(handoffWindowCopy("publisher", "2:59")).toBe(
      "Waiting for driver · 2:59 left",
    );
    expect(handoffSeekerWindowCopy("seeker", "2:59")).toBe(
      "Complete the handoff · 2:59 left",
    );
    expect(formatHandoffClock(179_000)).toBe("2:59");
  });
});
