/**
 * Canonical claim live-location topic helper.
 * Copied into the Edge Function bundle (Deno cannot import from src/).
 * Keep in lockstep with src/lib/location/topic.ts — tested together.
 */
export const CLAIM_LOCATION_TOPIC_PREFIX = "claim-location:";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getClaimLocationTopic(claimId: string): string | null {
  const id = claimId.trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    return null;
  }
  return `${CLAIM_LOCATION_TOPIC_PREFIX}${id}`;
}
