import { describe, expect, it } from "vitest";

import {
  LIVE_LOCATION_PAUSE_WHILE_NAVIGATING,
  liveLocationFreshness,
  liveLocationStatusLabel,
  liveLocationUpdatedLabel,
} from "@/lib/location/stale";

describe("live location stale labels", () => {
  const t0 = 1_000_000;

  it("waiting before first point uses neutral publisher copy", () => {
    expect(liveLocationFreshness(null, t0)).toBe("waiting");
    expect(liveLocationStatusLabel("waiting")).toBe(
      "Waiting for driver location",
    );
    expect(liveLocationUpdatedLabel("waiting", null, t0)).toBe("Waiting");
  });

  it("live within 10s", () => {
    expect(liveLocationFreshness(t0, t0 + 5_000)).toBe("live");
    expect(liveLocationStatusLabel("live")).toBe("Live location");
    expect(liveLocationUpdatedLabel("live", t0, t0 + 5_000)).toBe(
      "Updated just now",
    );
  });

  it("delayed between 10 and 25s", () => {
    expect(liveLocationFreshness(t0, t0 + 15_000)).toBe("delayed");
    expect(liveLocationStatusLabel("delayed")).toBe("Location update delayed");
    expect(liveLocationUpdatedLabel("delayed", t0, t0 + 15_000)).toBe(
      "Updated 15 seconds ago",
    );
  });

  it("paused after 25s", () => {
    expect(liveLocationFreshness(t0, t0 + 30_000)).toBe("paused");
    expect(liveLocationStatusLabel("paused")).toBe("Live location paused");
    expect(liveLocationUpdatedLabel("paused", t0, t0 + 30_000)).toBe(
      "Last update 30 seconds ago",
    );
    expect(LIVE_LOCATION_PAUSE_WHILE_NAVIGATING).toBe(
      "Live location paused while the driver is navigating",
    );
  });

  it("unavailable uses calm connection copy", () => {
    expect(liveLocationStatusLabel("unavailable")).toBe(
      "Live location temporarily unavailable",
    );
  });
});
