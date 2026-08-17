import type { SeekerLocationPayload } from "@/lib/location/payload";

export type SeekerLocationOrdering = {
  sequence: number;
  sentAt: number;
};

/** Shared ordering for Broadcast payloads and DB snapshots (sequence, then sentAt). */
export function isNewerSeekerLocation(
  incoming: SeekerLocationOrdering,
  current: SeekerLocationOrdering | null | undefined,
): boolean {
  if (!current) {
    return true;
  }
  if (incoming.sequence > current.sequence) {
    return true;
  }
  if (incoming.sequence < current.sequence) {
    return false;
  }
  return incoming.sentAt >= current.sentAt;
}

export function pickNewerSeekerLocation(
  a: SeekerLocationPayload | null,
  b: SeekerLocationPayload | null,
): SeekerLocationPayload | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return isNewerSeekerLocation(b, a) ? b : a;
}
