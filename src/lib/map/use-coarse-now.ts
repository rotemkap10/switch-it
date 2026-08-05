"use client";

import { useEffect, useState } from "react";

/** Shared coarse clock for discovery UI (minute-level is enough). */
export function useCoarseNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
