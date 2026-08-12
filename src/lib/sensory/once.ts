/**
 * One-shot sensory events (client-only).
 * sessionStorage + memory so Realtime refetch/reconnect/remount
 * cannot replay the same claim or completed handoff.
 */

const playedMemory = new Set<string>();

export function resetSensoryOnceForTests() {
  playedMemory.clear();
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("switch-it:sensory-once:")) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
}

function storageKey(semanticKey: string): string {
  return `switch-it:sensory-once:${semanticKey}`;
}

/** Returns true only the first time this semantic key should fire. */
export function consumeSensoryOnce(semanticKey: string): boolean {
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

export function decidePublisherClaimFeedback(input: {
  previousStatus: string | null;
  nextStatus: string;
  claimId?: string | null;
  spotId: string;
}): { play: true; dedupeKey: string } | { play: false } {
  if (input.previousStatus !== "available" || input.nextStatus !== "claimed") {
    return { play: false };
  }

  const claimId = input.claimId?.trim();
  return {
    play: true,
    dedupeKey: claimId ? `claim-received:${claimId}` : `claim-received:spot:${input.spotId}`,
  };
}
