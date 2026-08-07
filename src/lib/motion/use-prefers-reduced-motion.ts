import { useEffect, useState } from "react";

import { prefersReducedMotionMedia } from "@/lib/motion/app-launch";

/** Subscribes to prefers-reduced-motion for map transitions and controls. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const id = window.setTimeout(() => setReduced(false), 0);
      return () => window.clearTimeout(id);
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return reduced;
}

export { prefersReducedMotionMedia };
