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
export type HandoffCountdownProximity = "close" | null;

type HandoffWindowCountdownProps = {
  availableAtIso: string;
  expiresAtIso: string;
  handoffStartedAtIso?: string | null;
  /** When true, the due phase displays as the live 3-minute window. */
  claimed?: boolean;
  /** Role-specific waiting / window copy. */
  role: "publisher" | "seeker";
  className?: string;
  /** Short labels for collapsed cards. Omits the helper line. */
  compact?: boolean;
  /** Close-range wording once the meetup window is live. */
  proximity?: HandoffCountdownProximity;
  /** Fired once when the shared deadline is reached (client hint). */
  onExpired?: () => void;
  /**
   * Fired once when a claimed handoff reaches estimated departure.
   * Persist canonical start on the server — not a client-only transition.
   */
  onDepartureDue?: () => void;
};

export function handoffScheduledCopy(clock: string, compact = false): string {
  return compact ? `Handoff in ${clock}` : `Handoff starts in ${clock}`;
}

export function handoffUnclaimedDueCopy(
  role: "publisher" | "seeker",
  clock: string,
): string {
  return role === "publisher"
    ? `Waiting for a driver · ${clock} left`
    : `Handoff starts in ${clock}`;
}

export function handoffMeetupCopy(clock: string, compact = false): string {
  return compact ? `Meetup · ${clock}` : `Meetup window · ${clock} left`;
}

export function handoffCloseCopy(
  role: "publisher" | "seeker",
  clock: string,
  compact = false,
): string {
  if (compact) {
    return handoffMeetupCopy(clock, true);
  }
  return role === "publisher"
    ? `Driver is nearby · ${clock} left`
    : `You’re close · ${clock} left`;
}

export function handoffScheduledHelper(
  role: "publisher" | "seeker",
): string {
  return role === "publisher"
    ? "Then you’ll have 3 minutes to complete the handoff"
    : "Then you’ll have 3 minutes to meet";
}

export function handoffMeetupHelper(
  role: "publisher" | "seeker",
  claimed: boolean,
): string | null {
  if (!claimed) {
    return null;
  }
  return role === "publisher"
    ? "The driver is on the way"
    : "Head to the parking spot";
}

export function handoffCloseHelper(role: "publisher" | "seeker"): string {
  return role === "publisher"
    ? "Get ready to complete the handoff"
    : "Find the vehicle and complete the handoff";
}

function scheduledCopy(
  _role: "publisher" | "seeker",
  clock: string,
  compact: boolean,
): string {
  return handoffScheduledCopy(clock, compact);
}

function waitingCopy(
  role: "publisher" | "seeker",
  clock: string,
): string {
  return handoffUnclaimedDueCopy(role, clock);
}

function activeCopy(
  role: "publisher" | "seeker",
  clock: string,
  compact: boolean,
  proximity: HandoffCountdownProximity,
): string {
  if (proximity === "close") {
    return handoffCloseCopy(role, clock, compact);
  }
  return handoffMeetupCopy(clock, compact);
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
  compact = false,
  proximity = null,
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
      setAnnounce("Meetup window is open.");
      onDepartureDue?.();
    }
    if (previous === "scheduled" && phase === "active") {
      setAnnounce("Meetup window is open.");
    }
    if (phase === "active" && previous === "due") {
      setAnnounce("Meetup window is open.");
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
        data-compact={compact ? "true" : "false"}
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
  const clock = formatHandoffClock(remainingMs);
  const close = liveDisplay && proximity === "close";

  const line = liveDisplay
    ? activeCopy(role, clock, compact, close ? "close" : null)
    : phase === "due"
      ? waitingCopy(role, clock)
      : scheduledCopy(role, clock, compact);

  const helper = compact
    ? null
    : liveDisplay
      ? close
        ? handoffCloseHelper(role)
        : handoffMeetupHelper(role, isClaimed)
      : phase === "scheduled"
        ? handoffScheduledHelper(role)
        : null;

  return (
    <div
      className={className}
      data-testid="handoff-window-countdown"
      data-phase={displayPhase}
      data-near-expiry={nearExpiry ? "true" : "false"}
      data-compact={compact ? "true" : "false"}
    >
      <p
        className={[
          "text-sm font-semibold text-foreground",
          nearExpiry && !compact ? "text-base" : "",
        ].join(" ")}
      >
        {line}
      </p>
      {helper ? (
        <p
          className="mt-0.5 text-xs font-medium leading-4 text-muted"
          data-testid="handoff-window-helper"
        >
          {helper}
        </p>
      ) : null}
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
  activeCopy as handoffWindowCopy,
  activeCopy as handoffSeekerWindowCopy,
};
