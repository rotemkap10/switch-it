import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { startHandoffNowMock, refreshMock } = vi.hoisted(() => ({
  startHandoffNowMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/actions/spots", () => ({
  startHandoffNow: startHandoffNowMock,
}));

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { StartHandoffNowButton } from "@/components/spots/StartHandoffNowButton";

describe("StartHandoffNowButton", () => {
  beforeEach(() => {
    startHandoffNowMock.mockReset();
    refreshMock.mockReset();
    startHandoffNowMock.mockResolvedValue({
      success: true,
      alreadyStarted: false,
      handoffStartedAt: "2026-08-04T13:03:00.000Z",
      expiresAt: "2026-08-04T13:06:00.000Z",
    });
  });

  it("submits the spot id and refreshes after start", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <StartHandoffNowButton spotId="11111111-1111-4111-8111-111111111111" />
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
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
