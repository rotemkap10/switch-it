"use client";

import { useEffect, useRef, useState } from "react";

import {
  formatHandoffClock,
  formatWaitingMinutes,
  remainingMsUntil,
  resolveHandoffTimingPhase,
  type HandoffTimingPhase,
} from "@/lib/spots/handoff-phase";

export type HandoffPhase = HandoffTimingPhase;

type HandoffWindowCountdownProps = {
  availableAtIso: string;
  expiresAtIso: string;
  handoffStartedAtIso?: string | null;
  /** Role-specific waiting / window copy. */
  role: "publisher" | "seeker";
  className?: string;
  /** Fired once when the shared deadline is reached (client hint). */
  onExpired?: () => void;
};

function scheduledCopy(role: "publisher" | "seeker", minutes: number): string {
  return role === "publisher"
    ? `Leaving in ${minutes} min`
    : `Ready in ${minutes} min`;
}

function confirmCopy(role: "publisher" | "seeker", clock: string): string {
  return role === "publisher"
    ? `Start within ${clock}`
    : `Waiting for departure confirmation · ${clock}`;
}

function activeCopy(role: "publisher" | "seeker", clock: string): string {
  return role === "publisher"
    ? `Waiting for driver · ${clock} left`
    : `Complete the handoff · ${clock} left`;
}

/**
 * Dual-target countdown for estimated departure vs live handoff.
 * Remount with `key={expiresAtIso}` when the deadline changes.
 */
export function HandoffWindowCountdown({
  availableAtIso,
  expiresAtIso,
  handoffStartedAtIso = null,
  role,
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

  const phase = resolveHandoffTimingPhase({
    availableAtIso,
    expiresAtIso,
    handoffStartedAtIso,
    nowMs: now,
  });

  useEffect(() => {
    const previous = phaseRef.current;
    phaseRef.current = phase;

    if (previous === "scheduled" && phase === "confirm") {
      setAnnounce("Waiting for departure confirmation.");
    }
    if (
      (previous === "scheduled" || previous === "confirm") &&
      phase === "active"
    ) {
      setAnnounce("Handoff window is open.");
    }
    if (phase === "ended" && previous && previous !== "ended") {
      setAnnounce("Handoff expired.");
      if (!expiredNotifiedRef.current) {
        expiredNotifiedRef.current = true;
        onExpired?.();
      }
    }
  }, [phase, onExpired]);

  useEffect(() => {
    if (phase !== "active" && phase !== "confirm") {
      return;
    }
    const remaining = remainingMsUntil(expiresAtIso, now);
    if (
      remaining > 0 &&
      remaining <= 60_000 &&
      !oneMinuteAnnouncedRef.current
    ) {
      oneMinuteAnnouncedRef.current = true;
      setAnnounce("One minute remaining.");
    }
  }, [phase, expiresAtIso, now]);

  if (phase === "ended") {
    return (
      <div
        className={className}
        data-testid="handoff-window-countdown"
        data-phase="ended"
      >
        <p className="text-sm font-semibold text-foreground">Handoff expired</p>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    );
  }

  const remainingMs =
    phase === "scheduled"
      ? remainingMsUntil(availableAtIso, now)
      : remainingMsUntil(expiresAtIso, now);
  const nearExpiry =
    (phase === "active" || phase === "confirm") && remainingMs <= 60_000;

  const line =
    phase === "scheduled"
      ? scheduledCopy(role, formatWaitingMinutes(remainingMs))
      : phase === "confirm"
        ? confirmCopy(role, formatHandoffClock(remainingMs))
        : activeCopy(role, formatHandoffClock(remainingMs));

  return (
    <div
      className={className}
      data-testid="handoff-window-countdown"
      data-phase={phase}
      data-near-expiry={nearExpiry ? "true" : "false"}
    >
      {phase === "confirm" && role === "publisher" ? (
        <p className="text-sm font-semibold text-foreground">Ready to leave?</p>
      ) : null}
      <p
        className={[
          "text-sm font-semibold text-foreground",
          nearExpiry ? "text-base" : "",
        ].join(" ")}
      >
        {line}
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
  handoffStartedAtIso: string | null = null,
): HandoffPhase {
  return resolveHandoffTimingPhase({
    availableAtIso,
    expiresAtIso,
    handoffStartedAtIso,
    nowMs,
  });
}

export {
  formatHandoffClock,
  formatWaitingMinutes,
  scheduledCopy as handoffWaitingCopy,
  activeCopy as handoffWindowCopy,
  confirmCopy as handoffConfirmCopy,
  activeCopy as handoffSeekerWindowCopy,
};
