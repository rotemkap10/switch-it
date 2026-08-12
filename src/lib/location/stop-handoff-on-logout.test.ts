import { describe, expect, it, vi } from "vitest";

const stopHandoffTrackingBestEffort = vi.fn(async () => undefined);

vi.mock("@/lib/location/handoff-location-service", () => ({
  stopHandoffTrackingBestEffort: (...args: unknown[]) =>
    stopHandoffTrackingBestEffort(...args),
}));

import { onLogoutSubmit } from "@/lib/location/stop-handoff-on-logout";

describe("logout stops native handoff tracking", () => {
  it("F. stops tracking on logout submit", () => {
    onLogoutSubmit();
    expect(stopHandoffTrackingBestEffort).toHaveBeenCalledWith("logout");
  });
});
