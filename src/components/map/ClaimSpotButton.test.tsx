import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";

const { claimSpotMock } = vi.hoisted(() => ({
  claimSpotMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  claimSpot: claimSpotMock,
}));

const spotId = "550e8400-e29b-41d4-a716-446655440000";

describe("ClaimSpotButton", () => {
  beforeEach(() => {
    claimSpotMock.mockReset();
  });

  it("renders the friendly primary wording", () => {
    render(<ClaimSpotButton spotId={spotId} />);

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

    render(<ClaimSpotButton spotId={spotId} />);
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

    render(<ClaimSpotButton spotId={spotId} />);
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    const pendingButton = await screen.findByRole("button", {
      name: "On my way…",
    });
    expect(pendingButton).toBeDisabled();

    await user.click(pendingButton);
    expect(claimSpotMock).toHaveBeenCalledTimes(1);

    resolveClaim({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    expect(
      await screen.findByText("You’re on your way"),
    ).toBeInTheDocument();
  });

  it("displays an action error using the current alert UI", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      error: "This parking spot was already claimed.",
    });

    render(<ClaimSpotButton spotId={spotId} />);
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("This parking spot was already claimed.");
    expect(
      screen.getByRole("button", { name: "I’m on my way" }),
    ).toBeInTheDocument();
  });

  it("shows the success status after a successful claim action", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    render(<ClaimSpotButton spotId={spotId} />);
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(
      await screen.findByText("You’re on your way"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hold this spot until/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I’m on my way" }),
    ).not.toBeInTheDocument();
  });
});
