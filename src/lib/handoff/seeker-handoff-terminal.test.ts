import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  notifySeekerHandoffTerminal,
  registerSeekerHandoffForceStop,
  resetSeekerHandoffTerminalForTests,
  subscribeSeekerHandoffTerminal,
} from "@/lib/handoff/seeker-handoff-terminal";

describe("seeker-handoff-terminal", () => {
  beforeEach(() => {
    resetSeekerHandoffTerminalForTests();
  });

  it("invokes registered forceStop before terminal listeners", () => {
    const order: string[] = [];
    const forceStop = vi.fn(() => {
      order.push("forceStop");
    });
    registerSeekerHandoffForceStop(forceStop);
    subscribeSeekerHandoffTerminal(() => {
      order.push("listener");
    });

    notifySeekerHandoffTerminal({
      claimId: "11111111-1111-4111-8111-111111111111",
      reason: "publisher_cancel",
    });

    expect(forceStop).toHaveBeenCalled();
    expect(order).toEqual(["forceStop", "listener"]);
  });
});
