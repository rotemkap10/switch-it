const TOKEN_KEYS = new Set([
  "token",
  "accessToken",
  "authorization",
  "jwt",
  "apikey",
  "publishableKey",
]);

/**
 * Publisher-side live location receive diagnostics.
 * Flat single-line strings for Capacitor Logcat (no [object Object]).
 */
export function logHandoffLiveReceiver(
  stage: string,
  fields: Record<string, unknown> = {},
): void {
  const parts = Object.entries(fields)
    .filter(([key, value]) => !TOKEN_KEYS.has(key) && value != null && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`);
  const message = parts.length
    ? `[switch-it:handoff-live-receiver] ${stage} ${parts.join(" ")}`
    : `[switch-it:handoff-live-receiver] ${stage}`;
  console.info(message);
}
