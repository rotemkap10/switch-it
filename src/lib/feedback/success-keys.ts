/**
 * Allowlisted redirect feedback keys.
 * Never put arbitrary or sensitive text in the URL — only these keys.
 */
export const FEEDBACK_SUCCESS_KEYS = {
  "vehicle-added": "Vehicle added.",
  "vehicle-updated": "Vehicle updated.",
  "spot-published": "Your parking spot is live.",
  "spot-cancelled": "Parking spot removed.",
  "claim-created": "You’re on your way.",
  "claim-cancelled": "Parking claim cancelled.",
  "handoff-completed": "Handoff complete. One credit transferred.",
  "profile-updated": "Profile updated.",
} as const;

export type FeedbackSuccessKey = keyof typeof FEEDBACK_SUCCESS_KEYS;

export function isFeedbackSuccessKey(value: string): value is FeedbackSuccessKey {
  return Object.prototype.hasOwnProperty.call(FEEDBACK_SUCCESS_KEYS, value);
}

export function feedbackSuccessMessage(key: FeedbackSuccessKey): string {
  return FEEDBACK_SUCCESS_KEYS[key];
}

/** Append an allowlisted success key without leaking arbitrary messages. */
export function withFeedbackQuery(
  path: string,
  key: FeedbackSuccessKey,
): string {
  const [pathname, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("feedback", key);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
