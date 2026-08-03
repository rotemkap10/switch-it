import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AVAILABLE_IN_MINUTES_OPTIONS,
  SPOT_GRACE_MINUTES,
} from "@/lib/spots/constants";
import { publishSpotSchema } from "@/lib/validations/spot";

describe("publishSpotSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts valid coordinates and builds availability window", () => {
    const result = publishSpotSchema.safeParse({
      latitude: 32.0853,
      longitude: 34.7818,
      available_in_minutes: 10,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBe(32.0853);
      expect(result.data.longitude).toBe(34.7818);
      expect(result.data.address).toBeNull();
      expect(result.data.available_at).toBe("2026-08-03T12:10:00.000Z");
      expect(result.data.expires_at).toBe(
        new Date(
          Date.parse("2026-08-03T12:10:00.000Z") + SPOT_GRACE_MINUTES * 60_000,
        ).toISOString(),
      );
    }
  });

  it.each([...AVAILABLE_IN_MINUTES_OPTIONS])(
    "accepts supported timing preset %s",
    (minutes) => {
      const result = publishSpotSchema.safeParse({
        latitude: 0,
        longitude: 0,
        available_in_minutes: minutes,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const availableAt = new Date(
          Date.parse("2026-08-03T12:00:00.000Z") + minutes * 60_000,
        );
        expect(result.data.available_at).toBe(availableAt.toISOString());
        expect(result.data.expires_at).toBe(
          new Date(
            availableAt.getTime() + SPOT_GRACE_MINUTES * 60_000,
          ).toISOString(),
        );
      }
    },
  );

  it("accepts latitude and longitude at range boundaries", () => {
    expect(
      publishSpotSchema.safeParse({
        latitude: -90,
        longitude: -180,
        available_in_minutes: 0,
      }).success,
    ).toBe(true);

    expect(
      publishSpotSchema.safeParse({
        latitude: 90,
        longitude: 180,
        available_in_minutes: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects latitude outside -90 to 90", () => {
    expect(
      publishSpotSchema.safeParse({
        latitude: 91,
        longitude: 0,
        available_in_minutes: 0,
      }).success,
    ).toBe(false);

    expect(
      publishSpotSchema.safeParse({
        latitude: -91,
        longitude: 0,
        available_in_minutes: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects longitude outside -180 to 180", () => {
    expect(
      publishSpotSchema.safeParse({
        latitude: 0,
        longitude: 181,
        available_in_minutes: 0,
      }).success,
    ).toBe(false);

    expect(
      publishSpotSchema.safeParse({
        latitude: 0,
        longitude: -181,
        available_in_minutes: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported timing values", () => {
    expect(
      publishSpotSchema.safeParse({
        latitude: 0,
        longitude: 0,
        available_in_minutes: 7,
      }).success,
    ).toBe(false);

    expect(
      publishSpotSchema.safeParse({
        latitude: 0,
        longitude: 0,
        available_in_minutes: 35,
      }).success,
    ).toBe(false);
  });

  it("allows empty optional address and maps it to null", () => {
    const omitted = publishSpotSchema.safeParse({
      latitude: 1,
      longitude: 2,
      available_in_minutes: 0,
    });
    expect(omitted.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data.address).toBeNull();
    }

    const empty = publishSpotSchema.safeParse({
      latitude: 1,
      longitude: 2,
      address: "",
      available_in_minutes: 0,
    });
    expect(empty.success).toBe(true);
    if (empty.success) {
      expect(empty.data.address).toBeNull();
    }

    const whitespace = publishSpotSchema.safeParse({
      latitude: 1,
      longitude: 2,
      address: "   ",
      available_in_minutes: 0,
    });
    expect(whitespace.success).toBe(true);
    if (whitespace.success) {
      expect(whitespace.data.address).toBeNull();
    }
  });

  it("trims a provided address", () => {
    const result = publishSpotSchema.safeParse({
      latitude: 1,
      longitude: 2,
      address: "  Main St  ",
      available_in_minutes: 0,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address).toBe("Main St");
    }
  });

  it("rejects address longer than 200 characters", () => {
    const result = publishSpotSchema.safeParse({
      latitude: 1,
      longitude: 2,
      address: "a".repeat(201),
      available_in_minutes: 0,
    });

    expect(result.success).toBe(false);
  });
});
