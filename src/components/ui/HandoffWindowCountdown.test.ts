import { describe, expect, it } from "vitest";

import {
  formatHandoffClock,
  formatWaitingMinutes,
  getHandoffPhase,
  handoffWaitingCopy,
  handoffWindowCopy,
} from "@/components/ui/HandoffWindowCountdown";

describe("getHandoffPhase", () => {
  const available = "2026-08-04T12:10:00.000Z";
  const expires = "2026-08-04T12:15:00.000Z";

  it("is waiting before available_at", () => {
    expect(
      getHandoffPhase(available, expires, Date.parse("2026-08-04T12:05:00.000Z")),
    ).toBe("waiting");
  });

  it("is window between available_at and expires_at", () => {
    expect(
      getHandoffPhase(available, expires, Date.parse("2026-08-04T12:12:00.000Z")),
    ).toBe("window");
  });

  it("is ended at or after expires_at", () => {
    expect(
      getHandoffPhase(available, expires, Date.parse("2026-08-04T12:15:00.000Z")),
    ).toBe("ended");
  });
});

describe("handoff countdown copy", () => {
  it("answers what happens next while waiting", () => {
    expect(handoffWaitingCopy("publisher", 4)).toBe(
      "Your spot will be ready in 4 min",
    );
    expect(handoffWaitingCopy("seeker", 4)).toBe(
      "The spot should be ready in 4 min",
    );
    expect(formatWaitingMinutes(3 * 60_000 + 1)).toBe(4);
  });

  it("answers what happens next during the handoff window", () => {
    expect(handoffWindowCopy("publisher", "3:42")).toBe(
      "Driver handoff window · 3:42 left",
    );
    expect(handoffWindowCopy("seeker", "3:42")).toBe(
      "Complete the handoff · 3:42 left",
    );
    expect(formatHandoffClock(222_000)).toBe("3:42");
  });
});
