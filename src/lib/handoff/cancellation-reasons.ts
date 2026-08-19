export const SEEKER_CANCEL_REASONS = [
  "found_another_spot",
  "cant_make_it",
  "too_far",
  "other",
] as const;

export const PUBLISHER_CANCEL_REASONS = [
  "someone_else_took_spot",
  "had_to_leave",
  "cant_complete_handoff",
  "other",
] as const;

export type SeekerCancelReason = (typeof SEEKER_CANCEL_REASONS)[number];
export type PublisherCancelReason = (typeof PUBLISHER_CANCEL_REASONS)[number];
export type CancelActor = "seeker" | "publisher";

export const SEEKER_CANCEL_REASON_LABELS: Record<SeekerCancelReason, string> = {
  found_another_spot: "Found another spot",
  cant_make_it: "Can't make it",
  too_far: "Too far",
  other: "Other",
};

export const PUBLISHER_CANCEL_REASON_LABELS: Record<
  PublisherCancelReason,
  string
> = {
  someone_else_took_spot: "Someone else took the spot",
  had_to_leave: "I had to leave",
  cant_complete_handoff: "Can't complete the handoff",
  other: "Other",
};

export function isSeekerCancelReason(
  value: string | null | undefined,
): value is SeekerCancelReason {
  return SEEKER_CANCEL_REASONS.includes(value as SeekerCancelReason);
}

export function isPublisherCancelReason(
  value: string | null | undefined,
): value is PublisherCancelReason {
  return PUBLISHER_CANCEL_REASONS.includes(value as PublisherCancelReason);
}
