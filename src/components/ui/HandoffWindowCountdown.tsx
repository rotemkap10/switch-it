"use client";

import { useEffect, useRef, useState } from "react";

import {
  formatHandoffClock,
  isLiveHandoffDisplay,
  remainingMsUntil,
  resolveHandoffTimingPhase,
  type HandoffTimingPhase,
} from "@/lib/spots/handoff-phase";

export type HandoffPhase = HandoffTimingPhase;

type HandoffWindowCountdownProps = {
  availableAtIso: string;
  expiresAtIso: string;
  handoffStartedAtIso?: string | null;
  /** When true, the due phase displays as the live 3-minute window. */
  claimed?: boolean;
  /** Role-specific waiting / window copy. */
  role: "publisher" | "seeker";
  className?: string;
  /** Fired once when the shared deadline is reached (client hint). */
  onExpired?: () => void;
  /**
   * Fired once when a claimed handoff reaches estimated departure.
   * Persist canonical start on the server — not a client-only transition.
   */
  onDepartureDue?: () => void;
};

function scheduledCopy(_role: "publisher" | "seeker", clock: string): string {
  return `Leaving in ${clock}`;
}

function waitingCopy(role: "publisher" | "seeker", clock: string): string {
  return role === "publisher"
    ? `Waiting for a driver · ${clock} left`
    : `Leaving in ${clock}`;
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
  claimed,
  role,
  className = "",
  onExpired,
  onDepartureDue,
}: HandoffWindowCountdownProps) {
  const isClaimed = claimed ?? role === "seeker";
  const [now, setNow] = useState(() => Date.now());
  const [announce, setAnnounce] = useState<string | null>(null);
  const phaseRef = useRef<HandoffPhase | null>(null);
  const expiredNotifiedRef = useRef(false);
  const dueNotifiedRef = useRef(false);
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
  const liveDisplay = isLiveHandoffDisplay(phase, isClaimed);

  useEffect(() => {
    const previous = phaseRef.current;
    phaseRef.current = phase;

    if (
      previous === "scheduled" &&
      phase === "due" &&
      isClaimed &&
      !dueNotifiedRef.current
    ) {
      dueNotifiedRef.current = true;
      setAnnounce("Handoff window is open.");
      onDepartureDue?.();
    }
    if (previous === "scheduled" && phase === "active") {
      setAnnounce("Handoff window is open.");
    }
    if (phase === "active" && previous === "due") {
      setAnnounce("Handoff window is open.");
    }
    if (phase === "ended" && previous && previous !== "ended") {
      setAnnounce("Handoff expired.");
      if (!expiredNotifiedRef.current) {
        expiredNotifiedRef.current = true;
        onExpired?.();
      }
    }
  }, [phase, isClaimed, onDepartureDue, onExpired]);

  useEffect(() => {
    if (phase === "due" && isClaimed && !dueNotifiedRef.current) {
      dueNotifiedRef.current = true;
      onDepartureDue?.();
    }
  }, [phase, isClaimed, onDepartureDue]);

  useEffect(() => {
    if (!liveDisplay) {
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
  }, [liveDisplay, expiresAtIso, now]);

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
  const displayPhase: HandoffPhase = liveDisplay
    ? "active"
    : phase === "due"
      ? "due"
      : phase;
  const nearExpiry = liveDisplay && remainingMs <= 60_000;

  const line = liveDisplay
    ? activeCopy(role, formatHandoffClock(remainingMs))
    : phase === "due"
      ? waitingCopy(role, formatHandoffClock(remainingMs))
      : scheduledCopy(role, formatHandoffClock(remainingMs));

  return (
    <div
      className={className}
      data-testid="handoff-window-countdown"
      data-phase={displayPhase}
      data-near-expiry={nearExpiry ? "true" : "false"}
    >
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
  scheduledCopy as handoffWaitingCopy,
  waitingCopy as handoffUnclaimedDueCopy,
  activeCopy as handoffWindowCopy,
  activeCopy as handoffSeekerWindowCopy,
};
