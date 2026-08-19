import { describe, expect, it } from "vitest";

import {
  isPublisherCancelReason,
  isSeekerCancelReason,
  PUBLISHER_CANCEL_REASON_LABELS,
  PUBLISHER_CANCEL_REASONS,
  SEEKER_CANCEL_REASON_LABELS,
  SEEKER_CANCEL_REASONS,
} from "@/lib/handoff/cancellation-reasons";

describe("cancellation reasons", () => {
  it("keeps seeker and publisher machine values distinct except Other", () => {
    expect([...SEEKER_CANCEL_REASONS]).toEqual([
      "found_another_spot",
      "cant_make_it",
      "too_far",
      "other",
    ]);
    expect([...PUBLISHER_CANCEL_REASONS]).toEqual([
      "someone_else_took_spot",
      "had_to_leave",
      "cant_complete_handoff",
      "other",
    ]);
    expect(isSeekerCancelReason("found_another_spot")).toBe(true);
    expect(isSeekerCancelReason("had_to_leave")).toBe(false);
    expect(isPublisherCancelReason("had_to_leave")).toBe(true);
    expect(isPublisherCancelReason("too_far")).toBe(false);
  });

  it("exposes UI labels separately from stored values", () => {
    expect(SEEKER_CANCEL_REASON_LABELS.found_another_spot).toBe(
      "Found another spot",
    );
    expect(PUBLISHER_CANCEL_REASON_LABELS.someone_else_took_spot).toBe(
      "Someone else took the spot",
    );
  });
});
