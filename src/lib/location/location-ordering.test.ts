import { describe, expect, it } from "vitest";

import {
  isNewerSeekerLocation,
  pickNewerSeekerLocation,
} from "@/lib/location/location-ordering";
import type { SeekerLocationPayload } from "@/lib/location/payload";

function loc(
  sequence: number,
  sentAt: number,
  latitude = 32.0,
): SeekerLocationPayload {
  return {
    latitude,
    longitude: 34.0,
    accuracyMeters: 12,
    headingDegrees: null,
    sequence,
    sentAt,
  };
}

describe("isNewerSeekerLocation", () => {
  it("accepts first location when none exists", () => {
    expect(isNewerSeekerLocation({ sequence: 1, sentAt: 1000 }, null)).toBe(true);
  });

  it("prefers higher sequence", () => {
    expect(isNewerSeekerLocation({ sequence: 2, sentAt: 1000 }, { sequence: 1, sentAt: 2000 })).toBe(
      true,
    );
    expect(isNewerSeekerLocation({ sequence: 1, sentAt: 3000 }, { sequence: 2, sentAt: 1000 })).toBe(
      false,
    );
  });

  it("breaks ties with sentAt", () => {
    expect(isNewerSeekerLocation({ sequence: 2, sentAt: 2000 }, { sequence: 2, sentAt: 1000 })).toBe(
      true,
    );
    expect(isNewerSeekerLocation({ sequence: 2, sentAt: 1000 }, { sequence: 2, sentAt: 2000 })).toBe(
      false,
    );
  });
});

describe("pickNewerSeekerLocation", () => {
  it("returns the newer payload", () => {
    expect(pickNewerSeekerLocation(loc(1, 1000, 32.1), loc(2, 1000, 32.2))?.latitude).toBe(
      32.2,
    );
  });
});
