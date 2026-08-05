import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearRealtimeFeedbackSuppression,
  isRealtimeFeedbackSuppressed,
  realtimeFeedbackKey,
  suppressRealtimeFeedback,
} from "@/lib/realtime/feedback-suppression";

describe("realtime feedback suppression", () => {
  afterEach(() => {
    clearRealtimeFeedbackSuppression();
    vi.useRealTimers();
  });

  it("suppresses matching keys until TTL expires", () => {
    vi.useFakeTimers();
    const key = realtimeFeedbackKey("claim", "c1", "cancelled");
    suppressRealtimeFeedback(key, 1000);
    expect(isRealtimeFeedbackSuppressed(key)).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(isRealtimeFeedbackSuppressed(key)).toBe(false);
  });

  it("does not suppress unrelated outcomes", () => {
    suppressRealtimeFeedback(realtimeFeedbackKey("claim", "c1", "cancelled"));
    expect(
      isRealtimeFeedbackSuppressed(
        realtimeFeedbackKey("claim", "c1", "completed"),
      ),
    ).toBe(false);
  });
});
