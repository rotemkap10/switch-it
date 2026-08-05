"use client";

import { useState } from "react";

const playedKeys = new Set<string>();

/** Test-only reset for session animation bookkeeping. */
export function resetSessionHandoffAnimationForTests() {
  playedKeys.clear();
}

function resolveSessionHandoffAnimation(key: string | null): boolean {
  if (!key || typeof window === "undefined") {
    return false;
  }

  const storageKey = `handoff-approach-${key}`;

  try {
    if (sessionStorage.getItem(storageKey) === "1" || playedKeys.has(storageKey)) {
      return false;
    }

    sessionStorage.setItem(storageKey, "1");
    playedKeys.add(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function useSessionHandoffAnimation(key: string | null): boolean {
  const [shouldAnimate] = useState(() => resolveSessionHandoffAnimation(key));
  return shouldAnimate;
}
