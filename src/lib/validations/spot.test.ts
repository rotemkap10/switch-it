import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeSpotAvailabilityWindow,
  INITIAL_HANDOFF_GRACE_MINUTES,
  LEAVE_DELAY_MAX_MINUTES,
  LEAVE_DELAY_MIN_MINUTES,
} from "@/lib/spots/constants";
import { publishSpotSchema } from "@/lib/validations/spot";

describe("publishSpotSchema", () => {
  it("accepts valid coordinates and delay without absolute timestamps", () => {
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
      expect(result.data.available_in_minutes).toBe(10);
      expect(result.data).not.toHaveProperty("available_at");
      expect(result.data).not.toHaveProperty("expires_at");
    }
  });

  it.each(
    Array.from(
      { length: LEAVE_DELAY_MAX_MINUTES - LEAVE_DELAY_MIN_MINUTES + 1 },
      (_, i) => i,
    ),
  )("accepts leave delay %s", (minutes) => {
    const result = publishSpotSchema.safeParse({
      latitude: 0,
      longitude: 0,
      available_in_minutes: minutes,
    });
    expect(result.success).toBe(true);
  });

  it("rejects leave delay above the 10-minute publish horizon", () => {
    expect(
      publishSpotSchema.safeParse({
        latitude: 32.0853,
        longitude: 34.7818,
        available_in_minutes: 11,
      }).success,
    ).toBe(false);
    expect(
      publishSpotSchema.safeParse({
        latitude: 32.0853,
        longitude: 34.7818,
        available_in_minutes: 20,
      }).success,
    ).toBe(false);
  });

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
  });

  it("rejects longitude outside -180 to 180", () => {
    expect(
      publishSpotSchema.safeParse({
        latitude: 0,
        longitude: 181,
        available_in_minutes: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported timing values including old presets", () => {
    for (const minutes of [-1, 21, 25, 30, 7.5, "abc"]) {
      expect(
        publishSpotSchema.safeParse({
          latitude: 0,
          longitude: 0,
          available_in_minutes: minutes,
        }).success,
      ).toBe(false);
    }
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
  });
});

describe("computeSpotAvailabilityWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates available_at from trusted now and expires_at +2 minutes initial grace", () => {
    const window = computeSpotAvailabilityWindow(10);
    expect(window.available_at).toBe("2026-08-03T12:10:00.000Z");
    expect(window.expires_at).toBe(
      new Date(
        Date.parse("2026-08-03T12:10:00.000Z") +
          INITIAL_HANDOFF_GRACE_MINUTES * 60_000,
      ).toISOString(),
    );
  });

  it("supports delay 0 as Now", () => {
    const window = computeSpotAvailabilityWindow(0);
    expect(window.available_at).toBe("2026-08-03T12:00:00.000Z");
    expect(window.expires_at).toBe("2026-08-03T12:02:00.000Z");
  });
});
