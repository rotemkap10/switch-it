import { CLAIM_LOCATION_TOPIC_PREFIX } from "@/lib/location/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Normalize and validate a claim UUID for topic use (lowercase). */
export function normalizeClaimIdForTopic(claimId: string): string | null {
  const normalized = claimId.trim().toLowerCase();
  if (!UUID_RE.test(normalized)) {
    return null;
  }
  return normalized;
}

/** Build private Broadcast topic `claim-location:<uuid>`. */
export function claimLocationTopic(claimId: string): string | null {
  const id = normalizeClaimIdForTopic(claimId);
  if (!id) {
    return null;
  }
  return `${CLAIM_LOCATION_TOPIC_PREFIX}${id}`;
}

/** Parse claim id from a topic; null if malformed. */
export function parseClaimLocationTopic(topic: string): string | null {
  if (!topic.startsWith(CLAIM_LOCATION_TOPIC_PREFIX)) {
    return null;
  }
  const rest = topic.slice(CLAIM_LOCATION_TOPIC_PREFIX.length);
  return normalizeClaimIdForTopic(rest);
}
