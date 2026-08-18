import { describe, expect, it } from "vitest";

import {
  formatHandoffClock,
  getHandoffPhase,
  handoffSeekerWindowCopy,
  handoffUnclaimedDueCopy,
  handoffWaitingCopy,
  handoffWindowCopy,
} from "@/components/ui/HandoffWindowCountdown";

describe("getHandoffPhase", () => {
  const available = "2026-08-04T12:10:00.000Z";
  const liveDeadline = "2026-08-04T12:13:00.000Z";

  it("is scheduled before available_at when the handoff has not started", () => {
    expect(
      getHandoffPhase(
        available,
        liveDeadline,
        Date.parse("2026-08-04T12:05:00.000Z"),
      ),
    ).toBe("scheduled");
  });

  it("is due between available_at and the live deadline when not yet started", () => {
    expect(
      getHandoffPhase(
        available,
        liveDeadline,
        Date.parse("2026-08-04T12:11:00.000Z"),
      ),
    ).toBe("due");
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

  it("is ended at available_at when the unclaimed listing has no extra window", () => {
    expect(
      getHandoffPhase(
        available,
        available,
        Date.parse("2026-08-04T12:10:00.000Z"),
      ),
    ).toBe("ended");
  });

  it("is ended at or after expires_at", () => {
    expect(
      getHandoffPhase(
        available,
        liveDeadline,
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
  it("shows a live estimated-departure clock before start", () => {
    expect(handoffWaitingCopy("publisher", "4:37")).toBe("Leaving in 4:37");
    expect(handoffWaitingCopy("seeker", "4:37")).toBe("Leaving in 4:37");
    expect(formatHandoffClock(4 * 60_000 + 37_000)).toBe("4:37");
  });

  it("keeps fallback waiting copy if an unclaimed listing is still open after the estimate", () => {
    expect(handoffUnclaimedDueCopy("publisher", "2:14")).toBe(
      "Waiting for a driver · 2:14 left",
    );
  });

  it("shows the live handoff countdown after start", () => {
    expect(handoffWindowCopy("publisher", "2:59")).toBe(
      "Waiting for driver · 2:59 left",
    );
    expect(handoffSeekerWindowCopy("seeker", "2:59")).toBe(
      "Complete the handoff · 2:59 left",
    );
    expect(formatHandoffClock(179_000)).toBe("2:59");
  });
});
