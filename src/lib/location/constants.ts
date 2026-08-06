/** Phase 9B live-location constants (foreground private Broadcast). */

/** Geolocation watch options — tuned for outdoor handoff walking/driving approach. */
export const LIVE_LOCATION_GEO_OPTIONS = {
  enableHighAccuracy: true,
  /** Prefer a fresh fix; allow a few seconds of cache to reduce GPS thrash. */
  maximumAgeMs: 4_000,
  timeoutMs: 10_000,
} as const;

/** Reject GPS samples with accuracy worse than this (meters). */
export const LIVE_LOCATION_MAX_ACCURACY_M = 150;

/** Hard floor: never broadcast position events faster than this. */
export const LIVE_LOCATION_MIN_SEND_INTERVAL_MS = 3_000;

/** Prefer sending when this much time passed and movement was meaningful. */
export const LIVE_LOCATION_PREFERRED_SEND_INTERVAL_MS = 4_000;

/** Movement that qualifies as meaningful (meters). */
export const LIVE_LOCATION_MEANINGFUL_MOVE_M = 20;

/** Heading delta (degrees) while moving that may justify a send. */
export const LIVE_LOCATION_HEADING_CHANGE_DEG = 35;

/** Accuracy improvement (meters) that may justify a send. */
export const LIVE_LOCATION_ACCURACY_IMPROVE_M = 25;

/** Heartbeat: send even without movement after this idle period. */
export const LIVE_LOCATION_HEARTBEAT_MS = 10_000;

/** Publisher UI: live / delayed / paused age thresholds. */
export const LIVE_LOCATION_STALE_LIVE_MS = 10_000;
export const LIVE_LOCATION_STALE_DELAYED_MS = 25_000;

/** Reject sentAt more than this far in the future (clock skew). */
export const LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS = 30_000;

export const CLAIM_LOCATION_TOPIC_PREFIX = "claim-location:" as const;

export const SEEKER_LOCATION_EVENT = "seeker-location" as const;
export const SEEKER_LOCATION_STATUS_EVENT = "seeker-location-status" as const;
