/**
 * Client-only completion UX for a successful parking handoff.
 *
 * The database claim status remains the source of truth. Callers present
 * this overlay only after `complete_claim` succeeds or Realtime reports
 * status = completed. One claim produces one overlay per device.
 */

/** Minimum time the success overlay stays readable on the auto-dismiss path. */
export const HANDOFF_COMPLETION_SUCCESS_MS = 2500;
/** Short fade after the destination view is ready (matches `--motion-fast`). */
export const HANDOFF_COMPLETION_OVERLAY_FADE_MS = 160;

export type HandoffCompletionRole = "publisher" | "seeker";

export type HandoffCompletionSuccessEvent = {
  claimId: string;
  role: HandoffCompletionRole;
};

export const HANDOFF_COMPLETION_COPY = {
  publisher: {
    title: "Handoff completed!",
    credit: "+1 credit",
    detail: "Thanks for sharing your spot.",
  },
  seeker: {
    title: "Handoff completed!",
    credit: "−1 credit",
    detail: "Enjoy your parking spot.",
  },
} as const;

type Listener = (event: HandoffCompletionSuccessEvent | null) => void;

let current: HandoffCompletionSuccessEvent | null = null;
const shownClaimIds = new Set<string>();
const listeners = new Set<Listener>();

function emit(event: HandoffCompletionSuccessEvent | null): void {
  for (const listener of listeners) {
    listener(event);
  }
}

/**
 * Show the completion overlay for this claim at most once on this device.
 * Returns false when this claim already presented (duplicate Realtime /
 * snapshot / remount).
 */
export function presentHandoffCompletionSuccess(
  event: HandoffCompletionSuccessEvent,
): boolean {
  const claimId = event.claimId.trim();
  if (!claimId) {
    return false;
  }
  if (shownClaimIds.has(claimId)) {
    return false;
  }
  shownClaimIds.add(claimId);
  current = { claimId, role: event.role };
  emit(current);
  return true;
}

export function dismissHandoffCompletionSuccess(): void {
  if (current == null) {
    return;
  }
  current = null;
  emit(null);
}

export function subscribeHandoffCompletionSuccess(listener: Listener): () => void {
  listeners.add(listener);
  if (current) {
    listener(current);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function peekHandoffCompletionSuccessForTests(): HandoffCompletionSuccessEvent | null {
  return current;
}

export function resetHandoffCompletionSuccessForTests(): void {
  current = null;
  shownClaimIds.clear();
  listeners.clear();
}
