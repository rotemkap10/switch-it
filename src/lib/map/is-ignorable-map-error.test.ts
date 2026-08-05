import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isIgnorableMapError,
  isMapTilerMilitaryLabelMismatch,
  logMapLibreError,
  normalizeMapErrorQuotes,
  resetIgnorableMapErrorLogState,
} from "@/lib/map/is-ignorable-map-error";

const MILITARY_MISMATCH =
  'Source layer "military_label" does not exist on source "maptiler_planet_v4" as specified by style layer "Military label".';

const MILITARY_MISMATCH_ESCAPED =
  'Source layer \\"military_label\\" does not exist on source \\"maptiler_planet_v4\\" as specified by style layer \\"Military label\\".';

describe("is-ignorable-map-error", () => {
  afterEach(() => {
    resetIgnorableMapErrorLogState();
    vi.restoreAllMocks();
  });

  it("ignores the exact military_label / maptiler_planet_v4 / Military label mismatch", () => {
    expect(isMapTilerMilitaryLabelMismatch(MILITARY_MISMATCH)).toBe(true);
    expect(isIgnorableMapError(new Error(MILITARY_MISMATCH))).toBe(true);
  });

  it("tolerates escaped quotation marks in the mismatch message", () => {
    expect(normalizeMapErrorQuotes(MILITARY_MISMATCH_ESCAPED)).toContain(
      '"military_label"',
    );
    expect(isMapTilerMilitaryLabelMismatch(MILITARY_MISMATCH_ESCAPED)).toBe(
      true,
    );
    expect(isIgnorableMapError(MILITARY_MISMATCH_ESCAPED)).toBe(true);
  });

  it("still treats an unrelated missing source layer as non-ignorable", () => {
    const other =
      'Source layer "poi" does not exist on source "maptiler_planet_v4" as specified by style layer "POI label".';
    expect(isMapTilerMilitaryLabelMismatch(other)).toBe(false);
    expect(isIgnorableMapError(other)).toBe(false);
  });

  it("does not ignore MapTiler authentication or network errors", () => {
    expect(isIgnorableMapError(new Error("Unauthorized"))).toBe(false);
    expect(
      isIgnorableMapError(new Error("Failed to fetch style from MapTiler")),
    ).toBe(false);
    expect(
      isIgnorableMapError(
        new Error("AJAXError: 403 Forbidden (MapTiler API key)"),
      ),
    ).toBe(false);
  });

  it("logs the military mismatch once with console.debug, never console.error", () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      logMapLibreError(new Error(MILITARY_MISMATCH));
      logMapLibreError(new Error(MILITARY_MISMATCH));

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });

  it("logs unrelated missing source-layer and auth errors with console.error", () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      logMapLibreError(
        new Error(
          'Source layer "waterway_label" does not exist on source "maptiler_planet_v4" as specified by style layer "Waterway label".',
        ),
      );
      logMapLibreError(new Error("Failed to fetch"));

      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(debugSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });
});
