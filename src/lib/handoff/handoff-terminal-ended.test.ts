import { describe, expect, it } from "vitest";

import {
  HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
  handoffTerminalEndedCopy,
  presentHandoffTerminalEnded,
  resetHandoffTerminalEndedForTests,
} from "@/lib/handoff/handoff-terminal-ended";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("handoff terminal ended copy", () => {
  it("uses the publisher-cancelled copy for each role", () => {
    expect(handoffTerminalEndedCopy("publisher_cancelled", "publisher")).toEqual({
      title: "Spot cancelled",
      detail: "This handoff has ended.",
      credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    });
    expect(handoffTerminalEndedCopy("publisher_cancelled", "seeker")).toEqual({
      title: "Handoff cancelled",
      detail: "The publisher cancelled the spot.",
      credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    });
  });

  it("uses the seeker-released copy for each role", () => {
    expect(handoffTerminalEndedCopy("seeker_released", "seeker")).toEqual({
      title: "Spot released",
      detail: "You released this handoff.",
      credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    });
    expect(handoffTerminalEndedCopy("seeker_released", "publisher")).toEqual({
      title: "Seeker released the spot",
      detail: "This handoff has ended.",
      credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    });
  });

  it("uses the same expired copy for both roles", () => {
    expect(handoffTerminalEndedCopy("expired", "publisher")).toEqual({
      title: "Handoff expired",
      detail: "The handoff window ended.",
      credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    });
    expect(handoffTerminalEndedCopy("expired", "seeker")).toEqual({
      title: "Handoff expired",
      detail: "The handoff window ended.",
      credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    });
  });

  it("presents a claim at most once", () => {
    resetHandoffTerminalEndedForTests();
    expect(
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "publisher_cancelled",
      }),
    ).toBe(true);
    expect(
      presentHandoffTerminalEnded({
        id: claimId,
        role: "publisher",
        kind: "expired",
      }),
    ).toBe(false);
  });
});
