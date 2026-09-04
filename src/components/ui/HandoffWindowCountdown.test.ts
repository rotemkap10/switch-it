import { describe, expect, it } from "vitest";

import {
  formatHandoffClock,
  getHandoffPhase,
  handoffCloseCopy,
  handoffCloseHelper,
  handoffMeetupCopy,
  handoffMeetupHelper,
  handoffScheduledCopy,
  handoffScheduledHelper,
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
    expect(handoffWaitingCopy("publisher", "4:37")).toBe(
      "Handoff starts in 4:37",
    );
    expect(handoffWaitingCopy("seeker", "4:37")).toBe("Handoff starts in 4:37");
    expect(handoffScheduledCopy("4:37")).toBe("Handoff starts in 4:37");
    expect(handoffScheduledCopy("0:43", true)).toBe("Handoff in 0:43");
    expect(formatHandoffClock(4 * 60_000 + 37_000)).toBe("4:37");
  });

  it("explains that a 3-minute meetup window follows", () => {
    expect(handoffScheduledHelper("seeker")).toBe(
      "Then you’ll have 3 minutes to meet",
    );
    expect(handoffScheduledHelper("publisher")).toBe(
      "Then you’ll have 3 minutes to complete the handoff",
    );
  });

  it("keeps fallback waiting copy if an unclaimed listing is still open after the estimate", () => {
    expect(handoffUnclaimedDueCopy("publisher", "2:14")).toBe(
      "Waiting for a driver · 2:14 left",
    );
  });

  it("shows meetup-window copy after start instead of restarting Leaving in", () => {
    expect(handoffWindowCopy("publisher", "2:59")).toBe(
      "Meetup window · 2:59 left",
    );
    expect(handoffSeekerWindowCopy("seeker", "2:59")).toBe(
      "Meetup window · 2:59 left",
    );
    expect(handoffMeetupCopy("2:59")).toBe("Meetup window · 2:59 left");
    expect(handoffMeetupCopy("2:50", true)).toBe("Meetup · 2:50");
    expect(handoffMeetupHelper("seeker", true)).toBe("Head to the parking spot");
    expect(handoffMeetupHelper("publisher", true)).toBe(
      "The driver is on the way",
    );
    expect(handoffMeetupHelper("publisher", false)).toBeNull();
    expect(formatHandoffClock(179_000)).toBe("2:59");
  });

  it("uses close-range meetup wording without dropping remaining time", () => {
    expect(handoffCloseCopy("seeker", "1:24")).toBe("You’re close · 1:24 left");
    expect(handoffCloseCopy("publisher", "1:24")).toBe(
      "Driver is nearby · 1:24 left",
    );
    expect(handoffCloseCopy("seeker", "1:24", true)).toBe("Meetup · 1:24");
    expect(handoffCloseHelper("seeker")).toBe(
      "Find the vehicle and complete the handoff",
    );
    expect(handoffCloseHelper("publisher")).toBe(
      "Get ready to complete the handoff",
    );
  });
});
