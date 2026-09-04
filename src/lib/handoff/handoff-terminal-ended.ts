/**
 * Client-only UX when a handoff ends without completion (cancel, release,
 * expiry). Callers present this only after an authoritative terminal status.
 * One claim/listing produces one overlay per device.
 */

import type { HandoffCompletionRole } from "@/lib/handoff/handoff-completion-success";

/** Minimum readable time on the auto-dismiss path (1.5–2.0s). */
export const HANDOFF_TERMINAL_ENDED_MS = 1800;

export type HandoffTerminalEndedKind =
  | "publisher_cancelled"
  | "seeker_released"
  | "expired";

export type HandoffTerminalEndedEvent = {
  id: string;
  role: HandoffCompletionRole;
  kind: HandoffTerminalEndedKind;
};

export const HANDOFF_TERMINAL_ENDED_COPY = {
  publisher_cancelled: {
    publisher: {
      title: "Spot cancelled",
      detail: "This handoff has ended.",
    },
    seeker: {
      title: "Handoff cancelled",
      detail: "The publisher cancelled the spot.",
    },
  },
  seeker_released: {
    publisher: {
      title: "Seeker released the spot",
      detail: "This handoff has ended.",
    },
    seeker: {
      title: "Spot released",
      detail: "You released this handoff.",
    },
  },
  expired: {
    publisher: {
      title: "Handoff expired",
      detail: "The handoff window ended.",
    },
    seeker: {
      title: "Handoff expired",
      detail: "The handoff window ended.",
    },
  },
} as const;

export const HANDOFF_TERMINAL_ENDED_CREDIT_LINE =
  "No credits were transferred.";

export function handoffTerminalEndedCopy(
  kind: HandoffTerminalEndedKind,
  role: HandoffCompletionRole,
): { title: string; detail: string; credit: string } {
  const copy = HANDOFF_TERMINAL_ENDED_COPY[kind][role];
  return {
    title: copy.title,
    detail: copy.detail,
    credit: HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
  };
}

type Listener = (event: HandoffTerminalEndedEvent | null) => void;

let current: HandoffTerminalEndedEvent | null = null;
const shownIds = new Set<string>();
const listeners = new Set<Listener>();

function emit(event: HandoffTerminalEndedEvent | null): void {
  for (const listener of listeners) {
    listener(event);
  }
}

/**
 * Show the non-completion terminal overlay at most once for this id.
 * Returns false when this id already presented (duplicate Realtime /
 * snapshot / remount).
 */
export function presentHandoffTerminalEnded(
  event: HandoffTerminalEndedEvent,
): boolean {
  const id = event.id.trim();
  if (!id) {
    return false;
  }
  if (shownIds.has(id)) {
    return false;
  }
  shownIds.add(id);
  current = { id, role: event.role, kind: event.kind };
  emit(current);
  return true;
}

export function dismissHandoffTerminalEnded(): void {
  if (current == null) {
    return;
  }
  current = null;
  emit(null);
}

export function subscribeHandoffTerminalEnded(listener: Listener): () => void {
  listeners.add(listener);
  if (current) {
    listener(current);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function peekHandoffTerminalEndedForTests(): HandoffTerminalEndedEvent | null {
  return current;
}

export function resetHandoffTerminalEndedForTests(): void {
  current = null;
  shownIds.clear();
  listeners.clear();
}
