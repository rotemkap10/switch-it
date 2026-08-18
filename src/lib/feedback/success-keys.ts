/**
 * Allowlisted redirect feedback keys.
 * Never put arbitrary or sensitive text in the URL — only these keys.
 * Values may use a newline to separate title and supporting message.
 */
export const FEEDBACK_SUCCESS_KEYS = {
  "vehicle-added": "Vehicle added.",
  "vehicle-updated": "Vehicle updated.",
  "spot-published": "Your parking spot is live.",
  "handoff-started": "Handoff started\nDrivers have a few minutes to complete it.",
  "spot-cancelled": "Spot cancelled\nNo credits were changed.",
  "handoff-cancelled-publisher":
    "Spot cancelled\nThe driver has been notified. No credits were changed.",
  "claim-created": "You’re on your way.",
  "claim-cancelled":
    "Spot released\nThe parking owner was notified. No credits were changed.",
  "handoff-completed": "Parking handoff complete\n1 credit was used.",
  "handoff-completed-publisher": "Spot handed off\nYou earned 1 credit.",
  "handoff-expired":
    "Handoff expired\nThe handoff window ended. No credits were changed.",
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
