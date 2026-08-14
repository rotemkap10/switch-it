import {
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";

/**
 * Canonical native → Edge Function JSON body.
 * Optional heading is omitted (never JSON null / NSNull) so serialization
 * cannot fail on iOS when course is invalid.
 */
export function buildNativeSeekerLocationPostBody(input: {
  claimId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  headingDegrees: number | null;
  sequence: number;
  sentAt: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    sequence: input.sequence,
    sentAt: input.sentAt,
  };
  if (input.headingDegrees != null) {
    payload.headingDegrees = input.headingDegrees;
  }
  return {
    claimId: input.claimId,
    event: SEEKER_LOCATION_EVENT,
    payload,
  };
}

export function serializeNativeSeekerLocationPostBody(input: {
  claimId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  headingDegrees: number | null;
  sequence: number;
  sentAt: number;
}): string {
  return JSON.stringify(buildNativeSeekerLocationPostBody(input));
}

export function nativePostLogFields(input: {
  claimId: string;
  latitude: number;
  longitude: number;
  sentAt: number;
  event?: string;
}): Record<string, unknown> {
  return {
    claimId: input.claimId,
    lat: input.latitude,
    lng: input.longitude,
    timestamp: input.sentAt,
    event: input.event ?? SEEKER_LOCATION_EVENT,
  };
}

export { SEEKER_LOCATION_EVENT, SEEKER_LOCATION_STATUS_EVENT };
