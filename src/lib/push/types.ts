export const HANDOFF_PUSH_TYPES = [
  "spot_cancelled",
  "driver_claimed",
  "seeker_cancelled",
  "handoff_expiring_soon",
  "driver_nearby",
  "handoff_completed",
] as const;

export type HandoffPushType = (typeof HANDOFF_PUSH_TYPES)[number];

export type HandoffPushRecipientRole = "seeker" | "publisher";

export const HANDOFF_PUSH_COPY: Record<
  HandoffPushType,
  { title: string; body: string }
> = {
  spot_cancelled: {
    title: "Parking spot unavailable",
    body: "This parking spot is no longer available.",
  },
  driver_claimed: {
    title: "Driver on the way",
    body: "A driver claimed your parking spot and is heading to you.",
  },
  seeker_cancelled: {
    title: "Driver cancelled",
    body: "The driver is no longer coming. Your parking spot is available again.",
  },
  handoff_expiring_soon: {
    title: "Handoff ending soon",
    body: "Your parking handoff will expire soon.",
  },
  driver_nearby: {
    title: "Driver is almost there",
    body: "The driver is getting close to your parking spot.",
  },
  handoff_completed: {
    title: "Handoff completed",
    body: "The parking handoff was completed successfully.",
  },
};

/** Straight-line nearby threshold for driver_nearby push. Not a route API. */
export const DRIVER_NEARBY_PUSH_METERS = 150;

export function isHandoffPushType(value: unknown): value is HandoffPushType {
  return (
    typeof value === "string" &&
    (HANDOFF_PUSH_TYPES as readonly string[]).includes(value)
  );
}

export function isTerminalHandoffPushType(type: HandoffPushType): boolean {
  return (
    type === "spot_cancelled" ||
    type === "seeker_cancelled" ||
    type === "handoff_completed"
  );
}
