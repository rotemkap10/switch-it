"use client";

import { useState } from "react";

import { claimOneShotAnimation } from "@/lib/motion/one-shot";

/** True once per session for the given semantic key (mount-time claim). */
export function useOneShotAnimation(semanticKey: string | null): boolean {
  const [shouldAnimate] = useState(() =>
    semanticKey ? claimOneShotAnimation(semanticKey) : false,
  );
  return shouldAnimate;
}
