/**
 * MapLibre / MapTiler error classification.
 * Keep fatal escalation narrow — provider style/source noise must not destroy maps.
 */

export type MapErrorClass = "fatal" | "ignorable" | "recoverable";

export function mapErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      error?: unknown;
      status?: unknown;
    };
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (record.error != null) {
      return mapErrorMessage(record.error);
    }
    if (typeof record.status === "number") {
      return `HTTP ${record.status}`;
    }
  }
  return "";
}

/** Normalize escaped quotes so predicates work for JSON-escaped console text. */
export function normalizeMapErrorQuotes(message: string): string {
  return message.replace(/\\(["'])/g, "$1");
}

/**
 * Known MapTiler streets-v4 / Planet v4 mismatch:
 * style layer "Military label" asks for source-layer "military_label",
 * but maptiler_planet_v4 exposes "military" instead.
 */
export function isMapTilerMilitaryLabelMismatch(error: unknown): boolean {
  const text = normalizeMapErrorQuotes(mapErrorMessage(error));
  if (!text) {
    return false;
  }

  const hasSourceLayer = /source layer\s+["']military_label["']/i.test(text);
  const hasPlanetSource = /on source\s+["']maptiler_planet_v4["']/i.test(text);
  const hasStyleLayer = /style layer\s+["']Military label["']/i.test(text);

  return hasSourceLayer && hasPlanetSource && hasStyleLayer;
}

/** Any MapTiler/MapLibre "source layer missing on style layer" provider mismatch. */
export function isStyleSourceLayerMismatch(error: unknown): boolean {
  const text = normalizeMapErrorQuotes(mapErrorMessage(error));
  if (!text) {
    return false;
  }
  return (
    /source layer\s+["'][^"']+["']/i.test(text) &&
    /does not exist on source/i.test(text) &&
    /style layer\s+["'][^"']+["']/i.test(text)
  );
}

function isMissingImageNoise(message: string): boolean {
  return /could not be loaded|Image "/i.test(message);
}

function isFatalStyleOrAuthFailure(message: string): boolean {
  if (!message) {
    return false;
  }
  if (/unauthorized|forbidden|invalid (api )?key/i.test(message)) {
    return true;
  }
  if (/AJAXError:\s*(401|403|404)\b/i.test(message)) {
    return true;
  }
  if (/failed to fetch (the )?style|failed to load style|style\.json/i.test(message)) {
    return true;
  }
  if (/webgl|failed to initialize|failed to create map/i.test(message)) {
    return true;
  }
  return false;
}

/**
 * Classify a MapLibre error event payload or Error.
 *
 * - fatal: style auth/init failure — replace the map with retry UI
 * - ignorable: known provider noise (military_label, missing images, source-layer mismatches)
 * - recoverable: transient tile/network noise that should not destroy a map
 */
export function classifyMapLibreError(error: unknown): MapErrorClass {
  const message = mapErrorMessage(error);

  if (isMapTilerMilitaryLabelMismatch(error) || isStyleSourceLayerMismatch(error)) {
    return "ignorable";
  }
  if (isMissingImageNoise(message)) {
    return "ignorable";
  }
  if (isFatalStyleOrAuthFailure(message)) {
    return "fatal";
  }
  // Default: do not destroy the map for unclassified provider/tile noise.
  return "recoverable";
}

export function isIgnorableMapError(error: unknown): boolean {
  return classifyMapLibreError(error) === "ignorable";
}

/** True when BaseMap should escalate to the unavailable/retry UI. */
export function shouldEscalateMapUnavailable(
  error: unknown,
  styleLoaded: boolean,
): boolean {
  if (styleLoaded) {
    // After a successful style load, never tear down for tile/image/source noise.
    return false;
  }
  return classifyMapLibreError(error) === "fatal";
}

const loggedMilitaryLabelMismatch = { current: false };

/** Test helper — reset one-shot debug dedupe between cases. */
export function resetIgnorableMapErrorLogState(): void {
  loggedMilitaryLabelMismatch.current = false;
}

/**
 * Development logging for map errors.
 * Ignorable provider mismatches use console.debug once; others use console.error.
 */
export function logMapLibreError(error: unknown): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const message = mapErrorMessage(error) || "Unknown map error";
  const kind = classifyMapLibreError(error);

  if (kind === "ignorable") {
    if (isMapTilerMilitaryLabelMismatch(error)) {
      if (loggedMilitaryLabelMismatch.current) {
        return;
      }
      loggedMilitaryLabelMismatch.current = true;
      console.debug(
        "[map] Ignoring known MapTiler style/source mismatch:",
        message,
      );
      return;
    }
    if (isMissingImageNoise(message)) {
      return;
    }
    console.debug("[map] Ignoring style/source mismatch:", message);
    return;
  }

  if (kind === "recoverable") {
    console.debug("[map] Recoverable map error:", message);
    return;
  }

  // Never log style URLs or API keys.
  console.error("[map] Fatal MapLibre error:", message);
}
