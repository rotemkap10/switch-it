/**
 * One-time in-memory handoff: successful Claim → open navigation chooser.
 *
 * Survives ClaimSpotButton unmount when `/map` revalidates (same JS session).
 * Does not survive full reload, and is not written to the DB or sessionStorage.
 *
 * This is an interaction event (“I just claimed”), not active-claim state.
 */

let pendingClaimId: string | null = null;

/** Memoized start-open decision per claim id (Strict Mode remount-safe). */
const startOpenByClaimId = new Map<string, boolean>();

export function offerPostClaimNavigation(claimId: string): void {
  pendingClaimId = claimId;
  startOpenByClaimId.delete(claimId);
}

/**
 * Initial open flag for the navigation chooser on this claim.
 * First call records the decision; later remounts reuse it.
 */
export function initialPostClaimNavigationOpen(claimId: string): boolean {
  const existing = startOpenByClaimId.get(claimId);
  if (existing !== undefined) {
    return existing;
  }

  const shouldOpen = pendingClaimId === claimId;
  if (shouldOpen) {
    pendingClaimId = null;
  }
  startOpenByClaimId.set(claimId, shouldOpen);
  return shouldOpen;
}

/** User dismissed or chose a provider — do not auto-open again. */
export function clearPostClaimNavigationOffer(claimId: string): void {
  if (pendingClaimId === claimId) {
    pendingClaimId = null;
  }
  startOpenByClaimId.set(claimId, false);
}

export function peekPostClaimNavigationPendingForTests(): string | null {
  return pendingClaimId;
}

export function resetPostClaimNavigationForTests(): void {
  pendingClaimId = null;
  startOpenByClaimId.clear();
}
