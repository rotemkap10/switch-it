/**
 * In-memory bridge: navigation provider tap → start seeker live location.
 * Survives ActiveClaimPanel remount in the same JS session. Not persisted.
 */

type Starter = () => void;

let starter: Starter | null = null;
let pendingStart = false;

export function registerSeekerLiveLocationStarter(fn: Starter): () => void {
  starter = fn;
  if (pendingStart) {
    pendingStart = false;
    try {
      fn();
    } catch {
      // Best-effort; navigation must not depend on live location.
    }
  }
  return () => {
    if (starter === fn) {
      starter = null;
    }
  };
}

export function requestSeekerLiveLocationStart(): void {
  if (!starter) {
    pendingStart = true;
    return;
  }
  try {
    starter();
  } catch {
    // Best-effort; navigation must not depend on live location.
  }
}

export function resetSeekerLiveLocationIntentForTests(): void {
  starter = null;
  pendingStart = false;
}
