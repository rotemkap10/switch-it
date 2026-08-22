/** Shown when the publisher cancels while the seeker has an active handoff. */
export const SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE =
  "This parking spot is no longer available";

export type SeekerHandoffTerminalReason =
  | "publisher_cancel"
  | "expired"
  | "completed";

export type SeekerHandoffTerminalEvent = {
  claimId: string;
  reason: SeekerHandoffTerminalReason;
};

type TerminalListener = (event: SeekerHandoffTerminalEvent) => void;

const terminalListeners = new Set<TerminalListener>();

type ForceStopFn = () => void;
let registeredForceStop: ForceStopFn | null = null;

/** Register the active seeker live-share forceStop (while /map handoff is mounted). */
export function registerSeekerHandoffForceStop(fn: ForceStopFn): () => void {
  registeredForceStop = fn;
  return () => {
    if (registeredForceStop === fn) {
      registeredForceStop = null;
    }
  };
}

export function subscribeSeekerHandoffTerminal(
  listener: TerminalListener,
): () => void {
  terminalListeners.add(listener);
  return () => {
    terminalListeners.delete(listener);
  };
}

export function notifySeekerHandoffTerminal(
  event: SeekerHandoffTerminalEvent,
): void {
  registeredForceStop?.();
  for (const listener of terminalListeners) {
    listener(event);
  }
}

/** Test-only: drop listeners and forceStop registration between cases. */
export function resetSeekerHandoffTerminalForTests(): void {
  terminalListeners.clear();
  registeredForceStop = null;
}
