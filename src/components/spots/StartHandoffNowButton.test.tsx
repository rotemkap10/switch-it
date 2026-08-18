import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { startHandoffNowMock } = vi.hoisted(() => ({
  startHandoffNowMock: vi.fn(),
}));

vi.mock("@/actions/spots", () => ({
  startHandoffNow: startHandoffNowMock,
}));

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { StartHandoffNowButton } from "@/components/spots/StartHandoffNowButton";

describe("StartHandoffNowButton", () => {
  beforeEach(() => {
    startHandoffNowMock.mockReset();
    startHandoffNowMock.mockResolvedValue({
      success: true,
      alreadyStarted: false,
      handoffStartedAt: "2026-08-04T13:03:00.000Z",
      expiresAt: "2026-08-04T13:06:00.000Z",
    });
  });

  it("submits the spot id and reports the new deadline to the parent", async () => {
    const user = userEvent.setup();
    const onStarted = vi.fn();
    render(
      <FeedbackShell>
        <StartHandoffNowButton
          spotId="11111111-1111-4111-8111-111111111111"
          onStarted={onStarted}
        />
      </FeedbackShell>,
    );

    expect(screen.getByTestId("start-handoff-now")).toHaveTextContent(
      "I’m leaving now",
    );

    await user.click(screen.getByRole("button", { name: "I’m leaving now" }));

    await waitFor(() => {
      expect(startHandoffNowMock).toHaveBeenCalled();
    });

    const formData = startHandoffNowMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("spot_id")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith({
        handoffStartedAt: "2026-08-04T13:03:00.000Z",
        expiresAt: "2026-08-04T13:06:00.000Z",
        alreadyStarted: false,
      });
    });
  });

  it("toasts a business RPC error without throwing", async () => {
    startHandoffNowMock.mockResolvedValue({
      error: "This handoff can no longer be completed.",
      errorCode: "HANDOFF_UNAVAILABLE",
    });
    const user = userEvent.setup();
    const onStarted = vi.fn();

    render(
      <FeedbackShell>
        <StartHandoffNowButton
          spotId="11111111-1111-4111-8111-111111111111"
          onStarted={onStarted}
        />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "I’m leaving now" }));

    await waitFor(() => {
      expect(screen.getByTestId("feedback-toast-error")).toHaveTextContent(
        "This handoff can no longer be completed.",
      );
    });
    expect(onStarted).not.toHaveBeenCalled();
  });
});
