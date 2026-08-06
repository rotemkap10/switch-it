import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyMapLibreError,
  isIgnorableMapError,
  isMapTilerMilitaryLabelMismatch,
  logMapLibreError,
  normalizeMapErrorQuotes,
  resetIgnorableMapErrorLogState,
  shouldEscalateMapUnavailable,
} from "@/lib/map/is-ignorable-map-error";

const MILITARY_MISMATCH =
  'Source layer "military_label" does not exist on source "maptiler_planet_v4" as specified by style layer "Military label".';

const MILITARY_MISMATCH_ESCAPED =
  'Source layer \\"military_label\\" does not exist on source \\"maptiler_planet_v4\\" as specified by style layer \\"Military label\\".';

const OTHER_SOURCE_LAYER =
  'Source layer "waterway_label" does not exist on source "maptiler_planet_v4" as specified by style layer "Waterway label".';

describe("is-ignorable-map-error", () => {
  afterEach(() => {
    resetIgnorableMapErrorLogState();
    vi.restoreAllMocks();
  });

  it("ignores the exact military_label / maptiler_planet_v4 / Military label mismatch", () => {
    expect(isMapTilerMilitaryLabelMismatch(MILITARY_MISMATCH)).toBe(true);
    expect(isIgnorableMapError(new Error(MILITARY_MISMATCH))).toBe(true);
    expect(classifyMapLibreError(MILITARY_MISMATCH)).toBe("ignorable");
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

  it("treats other style/source-layer mismatches as ignorable (non-fatal)", () => {
    expect(classifyMapLibreError(OTHER_SOURCE_LAYER)).toBe("ignorable");
    expect(shouldEscalateMapUnavailable(OTHER_SOURCE_LAYER, false)).toBe(false);
  });

  it("escalates only fatal style/auth failures before style load", () => {
    expect(
      shouldEscalateMapUnavailable(new Error("Failed to fetch style"), false),
    ).toBe(true);
    expect(
      shouldEscalateMapUnavailable(
        new Error("AJAXError: 403 Forbidden (MapTiler API key)"),
        false,
      ),
    ).toBe(true);
    expect(shouldEscalateMapUnavailable(new Error(MILITARY_MISMATCH), false)).toBe(
      false,
    );
    expect(
      shouldEscalateMapUnavailable(
        new Error('Image "road_shield" could not be loaded'),
        false,
      ),
    ).toBe(false);
  });

  it("never escalates after style load", () => {
    expect(
      shouldEscalateMapUnavailable(new Error("Failed to fetch style"), true),
    ).toBe(false);
    expect(
      shouldEscalateMapUnavailable(new Error("AJAXError: 403 Forbidden"), true),
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

  it("logs fatal auth errors with console.error", () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      logMapLibreError(new Error("Failed to fetch style"));
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });
});
