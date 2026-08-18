export type HandoffTimingPhase =
  | "scheduled"
  | "due"
  | "active"
  | "ended";

export type HandoffTimingInput = {
  availableAtIso: string;
  expiresAtIso: string;
  handoffStartedAtIso?: string | null;
  nowMs?: number;
};

export function hasHandoffStarted(
  handoffStartedAtIso: string | null | undefined,
): boolean {
  if (!handoffStartedAtIso) {
    return false;
  }
  return Number.isFinite(new Date(handoffStartedAtIso).getTime());
}

export function resolveHandoffTimingPhase(
  input: HandoffTimingInput,
): HandoffTimingPhase {
  const now = input.nowMs ?? Date.now();
  const availableAt = new Date(input.availableAtIso).getTime();
  const expiresAt = new Date(input.expiresAtIso).getTime();
  if (!Number.isFinite(availableAt) || !Number.isFinite(expiresAt)) {
    return "ended";
  }
  if (now >= expiresAt) {
    return "ended";
  }
  if (hasHandoffStarted(input.handoffStartedAtIso)) {
    return "active";
  }
  if (now < availableAt) {
    return "scheduled";
  }
  return "due";
}

/** Claimed handoffs that have reached the estimate display as the live window. */
export function isLiveHandoffDisplay(
  phase: HandoffTimingPhase,
  claimed: boolean,
): boolean {
  return phase === "active" || (phase === "due" && claimed);
}

export function formatHandoffClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatWaitingMinutes(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

export function remainingMsUntil(
  targetIso: string,
  nowMs: number = Date.now(),
): number {
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) {
    return 0;
  }
  return Math.max(0, target - nowMs);
}
