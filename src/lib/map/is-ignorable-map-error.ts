/**
 * MapLibre / MapTiler error classification for non-fatal provider noise.
 * Keep this narrowly scoped — unexpected errors must still surface.
 */

export function mapErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
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
 *
 * Requires all three markers so other missing source-layer errors still log.
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

export function isIgnorableMapError(error: unknown): boolean {
  const message = mapErrorMessage(error);

  // Missing-image noise is handled (deduped) by the styleimagemissing listener.
  if (/could not be loaded|Image "/i.test(message)) {
    return true;
  }

  return isMapTilerMilitaryLabelMismatch(error);
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

  // Missing-image noise is handled (deduped) by the styleimagemissing listener.
  if (/could not be loaded|Image "/i.test(message)) {
    return;
  }

  // Never log style URLs or API keys.
  console.error("[map] MapLibre error:", message);
}
