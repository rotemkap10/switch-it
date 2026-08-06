const MAX_LABEL_LENGTH = 200;

/** Control characters and line breaks — plain text only. */
const CONTROL_OR_LINE_BREAK = /[\0-\x1F\x7F-\x9F\r\n\u2028\u2029]/g;

/** Rough coordinate-like patterns we must not persist as labels. */
const COORDINATE_LIKE =
  /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;

const URL_LIKE = /^https?:\/\//i;

/**
 * Shared client/server sanitization for display-only parking location labels.
 * Returns null when the value is empty or unusable after normalization.
 */
export function sanitizeLocationLabel(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  let text = value.replace(CONTROL_OR_LINE_BREAK, " ");
  text = text.trim().replace(/\s+/g, " ");

  if (text.length === 0) {
    return null;
  }

  if (text.length > MAX_LABEL_LENGTH) {
    text = text.slice(0, MAX_LABEL_LENGTH).trim();
  }

  if (text.length === 0 || COORDINATE_LIKE.test(text) || URL_LIKE.test(text)) {
    return null;
  }

  return text;
}
