export const HANDOFF_PUSH_COPY: Record<
  string,
  { title: string; body: string }
> = {
  spot_cancelled: {
    title: "Parking handoff cancelled",
    body: "The driver cancelled the parking handoff. Stop navigating to this spot.",
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

export const DRIVER_NEARBY_PUSH_METERS = 150;
