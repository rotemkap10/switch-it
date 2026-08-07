import { describe, expect, it } from "vitest";

import {
  liveLocationFreshness,
  liveLocationStatusLabel,
  liveLocationUpdatedLabel,
} from "@/lib/location/stale";

describe("live location stale labels", () => {
  const t0 = 1_000_000;

  it("waiting before first point uses neutral publisher copy", () => {
    expect(liveLocationFreshness(null, t0)).toBe("waiting");
    expect(liveLocationStatusLabel("waiting")).toBe("Waiting for live location");
    expect(liveLocationUpdatedLabel("waiting", null, t0)).toBe(
      "The driver can choose to share their progress.",
    );
  });

  it("live within 10s", () => {
    expect(liveLocationFreshness(t0, t0 + 5_000)).toBe("live");
    expect(liveLocationUpdatedLabel("live", t0, t0 + 5_000)).toBe(
      "Updated just now",
    );
  });

  it("delayed between 10 and 25s", () => {
    expect(liveLocationFreshness(t0, t0 + 15_000)).toBe("delayed");
    expect(liveLocationUpdatedLabel("delayed", t0, t0 + 15_000)).toBe(
      "Updated 15 seconds ago",
    );
  });

  it("paused after 25s", () => {
    expect(liveLocationFreshness(t0, t0 + 30_000)).toBe("paused");
    expect(liveLocationStatusLabel("paused")).toBe("Live location paused");
  });
});
