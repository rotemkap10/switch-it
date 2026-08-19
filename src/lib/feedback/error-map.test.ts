import { describe, expect, it } from "vitest";

import {
  APP_ERROR_MESSAGES,
  GENERIC_APP_ERROR,
  mapAppError,
} from "@/lib/feedback/error-map";
import {
  FEEDBACK_SUCCESS_KEYS,
  isFeedbackSuccessKey,
  withFeedbackQuery,
} from "@/lib/feedback/success-keys";

describe("mapAppError", () => {
  it.each(
    Object.entries(APP_ERROR_MESSAGES) as Array<
      [keyof typeof APP_ERROR_MESSAGES, string]
    >,
  )("maps %s to friendly copy", (code, message) => {
    expect(mapAppError(code).message).toBe(message);
    expect(mapAppError({ message: `RPC failed: ${code}` }).message).toBe(
      message,
    );
  });

  it("maps unknown errors to the generic fallback", () => {
    expect(
      mapAppError({ message: "relation does not exist" }).message,
    ).toBe(GENERIC_APP_ERROR);
    expect(mapAppError({ message: "secret uuid abc" }).message).not.toMatch(
      /uuid|relation/i,
    );
  });

  it("maps SPOT_UNAVAILABLE to friendly stale-claim copy", () => {
    expect(mapAppError("SPOT_UNAVAILABLE").message).toBe(
      "This spot was just claimed by another driver.",
    );
  });

  it("maps ALREADY_RELEASED_THIS_SPOT to reclaim copy", () => {
    expect(mapAppError("ALREADY_RELEASED_THIS_SPOT").message).toBe(
      "You already released this spot.",
    );
  });

  it("does not map an unrelated unique violation to a claim business error", () => {
    expect(
      mapAppError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "profiles_pkey"',
      }).message,
    ).toBe(GENERIC_APP_ERROR);
  });

  it("never returns raw database constraint text for known 23505 cases", () => {
    expect(
      mapAppError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "claims_one_active_per_seeker"',
      }).message,
    ).toBe(APP_ERROR_MESSAGES.ACTIVE_CLAIM_EXISTS);
    expect(
      mapAppError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "claims_one_active_per_spot"',
      }).message,
    ).toBe(APP_ERROR_MESSAGES.SPOT_UNAVAILABLE);
  });

  it("maps network-like failures", () => {
    expect(mapAppError({ message: "Failed to fetch" }).message).toBe(
      APP_ERROR_MESSAGES.NETWORK,
    );
  });
});

describe("feedback success keys", () => {
  it("only accepts allowlisted keys", () => {
    expect(isFeedbackSuccessKey("spot-published")).toBe(true);
    expect(isFeedbackSuccessKey("vehicle-photo-updated")).toBe(false);
    expect(isFeedbackSuccessKey("vehicle-photo-removed")).toBe(false);
    expect(isFeedbackSuccessKey("arbitrary<script>")).toBe(false);
    expect(FEEDBACK_SUCCESS_KEYS["spot-published"]).toBe(
      "Your parking spot is live.",
    );
  });

  it("appends feedback without allowing arbitrary messages", () => {
    expect(withFeedbackQuery("/spots/new", "spot-published")).toBe(
      "/spots/new?feedback=spot-published",
    );
  });
});
