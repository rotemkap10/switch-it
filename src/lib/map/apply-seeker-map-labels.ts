import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * EXPERIMENTAL / UNUSED IN PRODUCTION.
 *
 * A prior broad pass replaced any symbol `text-field` that mentioned `name*`
 * with HEBREW_PRIMARY_TEXT_FIELD. That also matched MapTiler layers whose
 * `text-field` mixed `format` + `image` (road shields like `road_` + network),
 * corrupting shield expressions and flooding `styleimagemissing`.
 *
 * Do not call `applySeekerMapLabelLanguage` from the live map until a narrow
 * filter exists (simple name-only place/street labels; never format/image/
 * icon-image/ref/shield/housenumber layers).
 *
 * Hebrew-first place labels for Israel/Tel Aviv (future use only).
 * Falls back to local/non-latin, then generic name, then latin/English.
 */
export const HEBREW_PRIMARY_TEXT_FIELD = [
  "coalesce",
  ["get", "name:he"],
  ["get", "name:nonlatin"],
  ["get", "name"],
  ["get", "name:latin"],
  ["get", "name:en"],
] as [
  "coalesce",
  ["get", "name:he"],
  ["get", "name:nonlatin"],
  ["get", "name"],
  ["get", "name:latin"],
  ["get", "name:en"],
];

const NAME_TOKEN_RE = /\{name(?::[A-Za-z0-9_-]+)?\}/;

function isPlaceNameProperty(key: string): boolean {
  return key === "name" || key.startsWith("name:");
}

/**
 * True when a text-field expression references OpenMapTiles place-name fields.
 * Ignores housenumber / ref / shield-only labels.
 */
export function expressionReferencesPlaceName(expr: unknown): boolean {
  if (typeof expr === "string") {
    return NAME_TOKEN_RE.test(expr);
  }

  if (!Array.isArray(expr)) {
    return false;
  }

  if (
    expr[0] === "get" &&
    typeof expr[1] === "string" &&
    isPlaceNameProperty(expr[1])
  ) {
    return true;
  }

  return expr.some((part) => expressionReferencesPlaceName(part));
}

/**
 * Rewrite basemap symbol layers to prefer Hebrew labels with local fallbacks.
 * Preserves icon-only layers and non-name text fields (refs, housenumbers).
 */
export function applySeekerMapLabelLanguage(map: MapLibreMap): void {
  const style = map.getStyle();
  const layers = style?.layers;
  if (!layers) {
    return;
  }

  for (const layer of layers) {
    if (layer.type !== "symbol") {
      continue;
    }

    const textField = layer.layout?.["text-field"];
    if (textField === undefined) {
      continue;
    }

    if (!expressionReferencesPlaceName(textField)) {
      continue;
    }

    map.setLayoutProperty(layer.id, "text-field", HEBREW_PRIMARY_TEXT_FIELD);
  }
}
