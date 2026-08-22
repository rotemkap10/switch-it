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
 * Greppable prefix for Android/iPhone two-device publisher QA.
 */
export function logHandoffLiveReceiver(
  stage: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (TOKEN_KEYS.has(key)) {
      continue;
    }
    safe[key] = value;
  }
  console.info(`[switch-it:handoff-live-receiver] ${stage}`, safe);
}
