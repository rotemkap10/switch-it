/**
 * One-shot session animations (client-only).
 * sessionStorage keys are namespaced `switch-it:anim:*` so Realtime refreshes
 * and ordinary remounts do not replay completed entrances.
 * No database fields; intentional decorative state only.
 */

const playedMemory = new Set<string>();

export function resetOneShotAnimationsForTests() {
  playedMemory.clear();
}

function storageKey(semanticKey: string): string {
  return `switch-it:anim:${semanticKey}`;
}

/** Returns true only the first time this semantic key should animate. */
export function claimOneShotAnimation(semanticKey: string): boolean {
  if (!semanticKey || typeof window === "undefined") {
    return false;
  }

  const key = storageKey(semanticKey);

  try {
    if (sessionStorage.getItem(key) === "1" || playedMemory.has(key)) {
      return false;
    }
    sessionStorage.setItem(key, "1");
    playedMemory.add(key);
    return true;
  } catch {
    if (playedMemory.has(key)) {
      return false;
    }
    playedMemory.add(key);
    return true;
  }
}
