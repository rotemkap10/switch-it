/** Publisher claim-detection Realtime diagnostics (real-device friendly). */
export function logClaimRealtime(
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (detail) {
    console.info(`[switch-it:claim-realtime] ${message}`, detail);
    return;
  }
  console.info(`[switch-it:claim-realtime] ${message}`);
}
