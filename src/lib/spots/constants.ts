/** Fixed grace period after available_at before the spot expires. */
export const SPOT_GRACE_MINUTES = 5;

/** When the spot becomes available, relative to server now. */
export const AVAILABLE_IN_MINUTES_OPTIONS = [
  0, 5, 10, 15, 20, 25, 30,
] as const;

export const GEOLOCATION_TIMEOUT_MS = 10_000;

export type AvailableInMinutes = (typeof AVAILABLE_IN_MINUTES_OPTIONS)[number];
