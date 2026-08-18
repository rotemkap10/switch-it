export type RecoverableFailurePhase = "mutation" | "render" | "realtime";

export type RecoverableFailureContext = {
  operation: string;
  phase: RecoverableFailurePhase;
  code?: string;
  route?: string;
  claimId?: string;
  spotId?: string;
};

/**
 * Production-safe diagnostic log for recovered failures.
 * Never include plates, coordinates, tokens, or raw SQL.
 */
export function logRecoverableFailure(
  scope: string,
  context: RecoverableFailureContext,
): void {
  console.error(`[switch-it] ${scope} recovered`, {
    operation: context.operation,
    phase: context.phase,
    code: context.code ?? "UNKNOWN",
    route: context.route,
    claimId: context.claimId,
    spotId: context.spotId,
  });
}
