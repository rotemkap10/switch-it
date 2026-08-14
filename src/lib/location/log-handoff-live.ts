const TOKEN_KEYS = new Set([
  "token",
  "accessToken",
  "authorization",
  "jwt",
  "apikey",
  "publishableKey",
]);

/**
 * Live-handoff pipeline diagnostics.
 * Always-on so production Capacitor + Safari two-device tests can be grepped
 * with the stable `[switch-it:handoff-live]` prefix. Never logs auth tokens.
 */
export function logHandoffLive(
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
  console.info(`[switch-it:handoff-live] ${stage}`, safe);
}
