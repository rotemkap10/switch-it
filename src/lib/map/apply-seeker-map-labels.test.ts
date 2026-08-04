import { describe, expect, it, vi } from "vitest";

import {
  HEBREW_PRIMARY_TEXT_FIELD,
  applySeekerMapLabelLanguage,
  expressionReferencesPlaceName,
} from "@/lib/map/apply-seeker-map-labels";

describe("apply-seeker-map-labels", () => {
  it("detects OpenMapTiles name fields and ignores ref/housenumber", () => {
    expect(expressionReferencesPlaceName(["get", "name:he"])).toBe(true);
    expect(expressionReferencesPlaceName(["get", "name"])).toBe(true);
    expect(
      expressionReferencesPlaceName([
        "coalesce",
        ["get", "name:en"],
        ["get", "name"],
      ]),
    ).toBe(true);
    expect(expressionReferencesPlaceName("{name:latin}")).toBe(true);
    expect(expressionReferencesPlaceName(["get", "ref"])).toBe(false);
    expect(expressionReferencesPlaceName(["get", "housenumber"])).toBe(false);
  });

  it("rewrites only place-name symbol layers to Hebrew-first coalesce", () => {
    const setLayoutProperty = vi.fn();
    const map = {
      getStyle: () => ({
        layers: [
          {
            id: "place-label",
            type: "symbol",
            layout: {
              "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
            },
          },
          {
            id: "road-shield",
            type: "symbol",
            layout: { "text-field": ["get", "ref"] },
          },
          {
            id: "icon-only",
            type: "symbol",
            layout: { "icon-image": "marker" },
          },
          {
            id: "fill",
            type: "fill",
            paint: {},
          },
        ],
      }),
      setLayoutProperty,
    };

    applySeekerMapLabelLanguage(map as never);

    expect(setLayoutProperty).toHaveBeenCalledTimes(1);
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "place-label",
      "text-field",
      HEBREW_PRIMARY_TEXT_FIELD,
    );
  });
});
