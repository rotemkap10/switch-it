/**
 * Live seeker-map presentation snapshot for overlays that must wait until
 * Find Parking is actually displayable — not a timeout stand-in.
 *
 * Reported by SeekerMapExperience. Cleared on unmount so a previous /map
 * visit cannot look "ready" while the seeker map is gone.
 */

export const HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS = 8000;

export type SeekerMapPresentation = {
  visuallyReady: boolean;
  activeClaimId: string | null;
};

const DEFAULT_PRESENTATION: SeekerMapPresentation = {
  visuallyReady: false,
  activeClaimId: null,
};

type Listener = (presentation: SeekerMapPresentation) => void;

let current: SeekerMapPresentation = DEFAULT_PRESENTATION;
const listeners = new Set<Listener>();

function samePresentation(
  a: SeekerMapPresentation,
  b: SeekerMapPresentation,
): boolean {
  return a.visuallyReady === b.visuallyReady && a.activeClaimId === b.activeClaimId;
}

function emit(presentation: SeekerMapPresentation): void {
  for (const listener of listeners) {
    listener(presentation);
  }
}

export function reportSeekerMapPresentation(
  presentation: SeekerMapPresentation,
): void {
  if (samePresentation(current, presentation)) {
    return;
  }
  current = presentation;
  emit(current);
}

export function clearSeekerMapPresentation(): void {
  reportSeekerMapPresentation(DEFAULT_PRESENTATION);
}

export function subscribeSeekerMapPresentation(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function peekSeekerMapPresentation(): SeekerMapPresentation {
  return current;
}

/**
 * Find Parking is ready to reveal under the completion overlay when the
 * seeker map has a usable frame and is no longer showing the completed claim.
 */
export function isSeekerMapReadyForHandoffReturn(completedClaimId: string): boolean {
  if (!current.visuallyReady) {
    return false;
  }
  return current.activeClaimId !== completedClaimId;
}

export function resetSeekerMapPresentationForTests(): void {
  current = DEFAULT_PRESENTATION;
  listeners.clear();
}
