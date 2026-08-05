import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";

const { claimSpotMock } = vi.hoisted(() => ({
  claimSpotMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  claimSpot: claimSpotMock,
}));

const spotId = "550e8400-e29b-41d4-a716-446655440000";

function renderClaimButton() {
  return render(
    <FeedbackShell>
      <ClaimSpotButton spotId={spotId} />
    </FeedbackShell>,
  );
}

describe("ClaimSpotButton", () => {
  beforeEach(() => {
    claimSpotMock.mockReset();
  });

  it("renders the friendly primary wording", () => {
    renderClaimButton();

    expect(
      screen.getByRole("button", { name: "I’m on my way" }),
    ).toBeInTheDocument();
  });

  it("invokes the claim action with the correct spot id", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    await waitFor(() => {
      expect(claimSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = claimSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("spot_id")).toBe(spotId);
  });

  it("shows a pending disabled state that prevents duplicate submits", async () => {
    const user = userEvent.setup();
    let resolveClaim: (value: {
      success: boolean;
      claimId: string;
      claimExpiresAt: string;
    }) => void = () => {};

    claimSpotMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClaim = resolve;
        }),
    );

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Claiming…",
    });
    expect(pendingButton).toBeDisabled();

    await user.click(pendingButton);
    expect(claimSpotMock).toHaveBeenCalledTimes(1);

    resolveClaim({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    expect(await screen.findByText("Opening your trip…")).toBeInTheDocument();
    expect(
      await screen.findByTestId("feedback-toast-success"),
    ).toHaveTextContent("You’re on your way.");
  });

  it("surfaces RPC errors via toast feedback", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      error: "This parking spot is no longer available.",
      errorCode: "SPOT_UNAVAILABLE",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByTestId("feedback-toast-error")).toHaveTextContent(
      "This parking spot is no longer available.",
    );
    expect(
      screen.getByRole("button", { name: "I’m on my way" }),
    ).toBeInTheDocument();
  });

  it("shows toast success after a successful claim action", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByText("Opening your trip…")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-toast-success")).toHaveTextContent(
      "You’re on your way.",
    );
    expect(
      screen.queryByRole("button", { name: "I’m on my way" }),
    ).not.toBeInTheDocument();
  });
});
