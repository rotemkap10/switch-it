/** Claim failures that mean the seeker map list may be stale. */
const STALE_DISCOVERY_CLAIM_CODES = new Set([
  "SPOT_UNAVAILABLE",
  "SPOT_NOT_FOUND",
  "SPOT_EXPIRED",
  "ALREADY_RELEASED_THIS_SPOT",
]);

export function shouldRevalidateMapAfterClaimFailure(
  errorCode: string | undefined,
): boolean {
  return errorCode != null && STALE_DISCOVERY_CLAIM_CODES.has(errorCode);
}
