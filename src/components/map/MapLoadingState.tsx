"use client";

import { useEffect, useState } from "react";

/** Delay before showing the slow-connection hint (within 2.5–4s guidance). */
export const MAP_SLOW_NETWORK_HINT_MS = 3000;

/** Loader ↔ map fade duration. */
export const MAP_READY_FADE_MS = 250;

type MapLoadingStateProps = {
  className?: string;
  /** Test override; otherwise uses prefers-reduced-motion. */
  reducedMotion?: boolean;
};

function useMediaPrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function ParkingPinIcon({ animate }: { animate: boolean }) {
  return (
    <div
      className={[
        "map-loading-pin",
        animate ? "map-loading-pin-animate" : "",
      ].join(" ")}
      aria-hidden="true"
    >
      <span className="map-loading-ring map-loading-ring-a" />
      <span className="map-loading-ring map-loading-ring-b" />
      <svg
        width="40"
        height="48"
        viewBox="0 0 40 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-[1]"
      >
        <path
          d="M20 46c0 0 14-14.2 14-26a14 14 0 1 0-28 0c0 11.8 14 26 14 26Z"
          fill="#55bff3"
          stroke="#ffffff"
          strokeWidth="2.5"
        />
        <circle cx="20" cy="18" r="7.5" fill="#ffffff" />
        <path
          d="M17.2 13.5h3.6c1.85 0 3 1 3 2.55 0 1.7-1.2 2.7-3.2 2.7H19.4v4.75h-2.2V13.5Z"
          fill="#55bff3"
        />
      </svg>
    </div>
  );
}

export function MapLoadingState({
  className = "",
  reducedMotion,
}: MapLoadingStateProps) {
  const mediaReduced = useMediaPrefersReducedMotion();
  const prefersReducedMotion =
    typeof reducedMotion === "boolean" ? reducedMotion : mediaReduced;
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setShowSlowHint(true);
    }, MAP_SLOW_NETWORK_HINT_MS);

    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center gap-3",
        "bg-gradient-to-b from-accent-soft to-surface px-4 text-center",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ParkingPinIcon animate={!prefersReducedMotion} />
      <p className="text-sm font-medium text-foreground">Loading the map…</p>
      <p className="max-w-xs min-h-[2.5rem] text-xs text-muted">
        {showSlowHint
          ? "This may take a moment on a slow connection."
          : null}
      </p>
    </div>
  );
}
