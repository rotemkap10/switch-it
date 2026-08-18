import { afterEach, describe, expect, it, vi } from "vitest";

const { rethrowMock } = vi.hoisted(() => ({
  rethrowMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => rethrowMock(error),
}));

import { actionErrorFromUnknown } from "@/lib/feedback/action-recovery";
import { APP_ERROR_MESSAGES } from "@/lib/feedback/error-map";

describe("actionErrorFromUnknown", () => {
  afterEach(() => {
    rethrowMock.mockReset();
  });

  it("maps a thrown network error to an action-level NETWORK failure", () => {
    const result = actionErrorFromUnknown(new Error("Failed to fetch"), "fallback", {
      operation: "start_handoff_now",
      spotId: "spot-1",
    });
    expect(rethrowMock).toHaveBeenCalled();
    expect(result.errorCode).toBe("NETWORK");
    expect(result.error).toBe(APP_ERROR_MESSAGES.NETWORK);
  });

  it("maps a thrown business code to the friendly action error", () => {
    const result = actionErrorFromUnknown(
      new Error("HANDOFF_UNAVAILABLE"),
      "Could not start the handoff.",
      { operation: "start_handoff_now" },
    );
    expect(result.errorCode).toBe("HANDOFF_UNAVAILABLE");
    expect(result.error).toBe(APP_ERROR_MESSAGES.HANDOFF_UNAVAILABLE);
  });

  it("rethrows Next.js control-flow errors", () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    rethrowMock.mockImplementation((error: unknown) => {
      throw error;
    });
    expect(() =>
      actionErrorFromUnknown(redirectError, "fallback", {
        operation: "start_handoff_now",
      }),
    ).toThrow(redirectError);
  });
});
