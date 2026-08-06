import { describe, expect, it } from "vitest";

import { getHandoffPhase } from "@/components/ui/HandoffWindowCountdown";

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
