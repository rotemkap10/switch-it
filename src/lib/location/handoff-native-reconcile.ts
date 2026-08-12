import { normalizeClaimIdForTopic } from "@/lib/location/topic";

export type NativeTrackingReconcileDecision =
  | { action: "keep"; claimId: string }
  | {
      action: "stop";
      reason: "disabled" | "expired" | "claim_changed";
    }
  | { action: "idle" };

export type NativeStartDecision =
  | { kind: "already_running" }
  | { kind: "start" }
  | { kind: "replace" }
  | { kind: "expired" }
  | { kind: "invalid_claim" };

/**
 * App restart / claim-change reconciliation.
 * Native tracking must not continue outside the current active handoff.
 */
export function decideNativeTrackingReconcile(input: {
  enabled: boolean;
  currentClaimId: string;
  expiresAtIso: string;
  nativeActive: boolean;
  nativeClaimId: string | null;
  nowMs?: number;
}): NativeTrackingReconcileDecision {
  const nowMs = input.nowMs ?? Date.now();
  const currentClaimId = normalizeClaimIdForTopic(input.currentClaimId);
  const nativeClaimId = input.nativeClaimId
    ? normalizeClaimIdForTopic(input.nativeClaimId)
    : null;
  const expired =
    !Number.isFinite(new Date(input.expiresAtIso).getTime()) ||
    new Date(input.expiresAtIso).getTime() <= nowMs;

  if (!input.enabled || !currentClaimId || expired) {
    if (input.nativeActive) {
      return {
        action: "stop",
        reason: !input.enabled || !currentClaimId ? "disabled" : "expired",
      };
    }
    return { action: "idle" };
  }

  if (input.nativeActive && nativeClaimId && nativeClaimId !== currentClaimId) {
    return { action: "stop", reason: "claim_changed" };
  }

  if (input.nativeActive && nativeClaimId === currentClaimId) {
    return { action: "keep", claimId: currentClaimId };
  }

  return { action: "idle" };
}

/** Prevent duplicate native GPS streams for the same claim. */
export function decideNativeStart(input: {
  claimId: string;
  expiresAtEpochMs: number;
  currentActive: boolean;
  currentClaimId: string | null;
  nowMs?: number;
}): NativeStartDecision {
  const claimId = normalizeClaimIdForTopic(input.claimId);
  if (!claimId) {
    return { kind: "invalid_claim" };
  }
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(input.expiresAtEpochMs) || input.expiresAtEpochMs <= nowMs) {
    return { kind: "expired" };
  }
  const currentClaimId = input.currentClaimId
    ? normalizeClaimIdForTopic(input.currentClaimId)
    : null;
  if (input.currentActive && currentClaimId === claimId) {
    return { kind: "already_running" };
  }
  if (input.currentActive && currentClaimId) {
    return { kind: "replace" };
  }
  return { kind: "start" };
}
