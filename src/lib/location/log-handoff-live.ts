/**
 * DEV-ONLY live-handoff pipeline diagnostics.
 * Prefix is stable so one claim can be grepped across seeker, native, publisher.
 */
export function logHandoffLive(
  stage: string,
  fields: Record<string, unknown> = {},
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (
      key === "token" ||
      key === "accessToken" ||
      key === "authorization" ||
      key === "jwt"
    ) {
      continue;
    }
    safe[key] = value;
  }
  console.info(`[switch-it:handoff-live] ${stage}`, safe);
}
