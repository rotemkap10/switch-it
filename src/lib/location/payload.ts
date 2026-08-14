import {
  LIVE_LOCATION_MAX_ACCURACY_M,
  LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS,
} from "@/lib/location/constants";

export type SeekerLocationPayload = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  headingDegrees: number | null;
  sequence: number;
  sentAt: number;
};

export type SeekerLocationStatusPayload = {
  status: "paused" | "stopped";
  sequence: number;
  sentAt: number;
};

function isSafePositiveInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseSeekerLocationPayload(
  value: unknown,
  nowMs: number = Date.now(),
): SeekerLocationPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const latitude = raw.latitude;
  const longitude = raw.longitude;
  const accuracyMeters = raw.accuracyMeters;
  const headingDegrees = raw.headingDegrees;
  const sequence = raw.sequence;
  const sentAt = raw.sentAt;

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    return null;
  }
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  if (
    !isFiniteNumber(accuracyMeters) ||
    accuracyMeters <= 0 ||
    accuracyMeters > LIVE_LOCATION_MAX_ACCURACY_M
  ) {
    return null;
  }
  let heading: number | null = null;
  if (headingDegrees !== null && headingDegrees !== undefined) {
    if (
      !isFiniteNumber(headingDegrees) ||
      headingDegrees < 0 ||
      headingDegrees > 360
    ) {
      return null;
    }
    heading = headingDegrees;
  }
  if (!isSafePositiveInt(sequence)) {
    return null;
  }
  if (!isFiniteNumber(sentAt) || sentAt <= 0) {
    return null;
  }
  if (sentAt > nowMs + LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracyMeters,
    headingDegrees: heading,
    sequence,
    sentAt,
  };
}

export function parseSeekerLocationStatusPayload(
  value: unknown,
  nowMs: number = Date.now(),
): SeekerLocationStatusPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const status = raw.status;
  const sequence = raw.sequence;
  const sentAt = raw.sentAt;

  if (status !== "paused" && status !== "stopped") {
    return null;
  }
  if (!isSafePositiveInt(sequence)) {
    return null;
  }
  if (!isFiniteNumber(sentAt) || sentAt <= 0) {
    return null;
  }
  if (sentAt > nowMs + LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS) {
    return null;
  }

  return { status, sequence, sentAt };
}

/** Whether a raw Geolocation accuracy is usable for publishing. */
export function isUsableAccuracy(accuracyMeters: number | null | undefined): boolean {
  return (
    typeof accuracyMeters === "number" &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > 0 &&
    accuracyMeters <= LIVE_LOCATION_MAX_ACCURACY_M
  );
}
