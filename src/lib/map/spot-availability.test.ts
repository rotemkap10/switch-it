import { describe, expect, it } from "vitest";

import {
  formatSpotAvailabilityLabel,
  isSpotStillListed,
  spotCarouselAddressLabel,
} from "@/lib/map/spot-availability";

describe("spot availability helpers", () => {
  const now = Date.parse("2026-08-05T12:00:00.000Z");

  it("shows Available now at or after available_at", () => {
    expect(
      formatSpotAvailabilityLabel("2026-08-05T11:59:00.000Z", now),
    ).toBe("Available now");
    expect(
      formatSpotAvailabilityLabel("2026-08-05T12:00:00.000Z", now),
    ).toBe("Available now");
  });

  it("shows minute-level pending copy before available_at", () => {
    expect(
      formatSpotAvailabilityLabel("2026-08-05T12:07:00.000Z", now),
    ).toBe("Available in 7 min");
  });

  it("filters expired spots", () => {
    expect(
      isSpotStillListed({ expires_at: "2026-08-05T12:01:00.000Z" }, now),
    ).toBe(true);
    expect(
      isSpotStillListed({ expires_at: "2026-08-05T11:59:00.000Z" }, now),
    ).toBe(false);
  });

  it("uses address fallback", () => {
    expect(spotCarouselAddressLabel("Arlozorov Street")).toBe(
      "Arlozorov Street",
    );
    expect(spotCarouselAddressLabel("  ")).toBe("Parking spot nearby");
    expect(spotCarouselAddressLabel(null)).toBe("Parking spot nearby");
  });
});
