"use client";

import { useEffect, useRef, useState } from "react";

export type HandoffPhase = "waiting" | "window" | "ended";

type HandoffWindowCountdownProps = {
  availableAtIso: string;
  expiresAtIso: string;
  /** Role-specific waiting copy. */
  waitingLabel: string;
  /** Role-specific in-window copy. */
  windowLabel: string;
  className?: string;
  /** Fired once when the shared deadline is reached (client hint). */
  onExpired?: () => void;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolvePhase(
  now: number,
  availableAt: number,
  expiresAt: number,
): HandoffPhase {
  if (!Number.isFinite(availableAt) || !Number.isFinite(expiresAt)) {
    return "ended";
  }
  if (now < availableAt) {
    return "waiting";
  }
  if (now < expiresAt) {
    return "window";
  }
  return "ended";
}

/**
 * Dual-target countdown for Model 1 handoff window.
 * Derives remaining time from absolute timestamps each tick (no drift counter).
 */
export function HandoffWindowCountdown({
  availableAtIso,
  expiresAtIso,
  waitingLabel,
  windowLabel,
  className = "",
  onExpired,
}: HandoffWindowCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const [announce, setAnnounce] = useState<string | null>(null);
  const phaseRef = useRef<HandoffPhase | null>(null);
  const expiredNotifiedRef = useRef(false);
  const oneMinuteAnnouncedRef = useRef(false);

  useEffect(() => {
    function tick() {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      setNow(Date.now());
    }

    const id = window.setInterval(tick, 1000);
    function onVisibility() {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const availableAt = new Date(availableAtIso).getTime();
  const expiresAt = new Date(expiresAtIso).getTime();
  const phase = resolvePhase(now, availableAt, expiresAt);

  useEffect(() => {
    const previous = phaseRef.current;
    phaseRef.current = phase;

    if (previous === "waiting" && phase === "window") {
      setAnnounce("Handoff window is open.");
    }
    if (phase === "ended" && previous && previous !== "ended") {
      setAnnounce("Handoff window ended.");
      if (!expiredNotifiedRef.current) {
        expiredNotifiedRef.current = true;
        onExpired?.();
      }
    }
  }, [phase, onExpired]);

  useEffect(() => {
    if (phase !== "window") {
      return;
    }
    const remaining = expiresAt - now;
    if (
      remaining > 0 &&
      remaining <= 60_000 &&
      !oneMinuteAnnouncedRef.current
    ) {
      oneMinuteAnnouncedRef.current = true;
      setAnnounce("One minute remaining in the handoff window.");
    }
  }, [phase, expiresAt, now]);

  if (phase === "ended") {
    return (
      <div
        className={className}
        data-testid="handoff-window-countdown"
        data-phase="ended"
      >
        <p className="text-sm font-semibold text-foreground">
          Handoff window ended
        </p>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    );
  }

  const remainingMs =
    phase === "waiting" ? availableAt - now : expiresAt - now;
  const label = phase === "waiting" ? waitingLabel : windowLabel;

  return (
    <div
      className={className}
      data-testid="handoff-window-countdown"
      data-phase={phase}
    >
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p
        className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-foreground"
        aria-hidden="true"
      >
        {formatRemaining(remainingMs)}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export function getHandoffPhase(
  availableAtIso: string,
  expiresAtIso: string,
  nowMs: number = Date.now(),
): HandoffPhase {
  return resolvePhase(
    nowMs,
    new Date(availableAtIso).getTime(),
    new Date(expiresAtIso).getTime(),
  );
}
