import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelClaimMock, cancelSpotMock } = vi.hoisted(() => ({
  cancelClaimMock: vi.fn(),
  cancelSpotMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  cancelClaim: cancelClaimMock,
}));

vi.mock("@/actions/spots", () => ({
  cancelSpot: cancelSpotMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/map",
}));

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { HandoffTerminalEndedController } from "@/components/handoff/HandoffTerminalEndedController";
import { HeaderCreditsBalance } from "@/components/layout/HeaderCreditsBalance";
import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { CancelSpotButton } from "@/components/spots/CancelSpotButton";
import { resetHandoffTerminalEndedForTests } from "@/lib/handoff/handoff-terminal-ended";

const claimId = "11111111-1111-4111-8111-111111111111";
const spotId = "550e8400-e29b-41d4-a716-446655440000";

describe("handoff terminal ended local actions", () => {
  beforeEach(() => {
    cancelClaimMock.mockReset();
    cancelSpotMock.mockReset();
    resetHandoffTerminalEndedForTests();
  });

  it("shows seeker release overlay after an authoritative cancel", async () => {
    cancelClaimMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <HeaderCreditsBalance credits={6} />
        <CancelClaimButton claimId={claimId} />
        <HandoffTerminalEndedController />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Release spot" }));
    await user.click(screen.getByRole("radio", { name: "Too far" }));
    const dialog = screen.getByTestId("cancel-claim-confirm");
    await user.click(dialog.querySelector("button[type='submit']") as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByTestId("handoff-terminal-overlay")).toBeInTheDocument();
    });
    expect(screen.getByText("Spot released")).toBeInTheDocument();
    expect(screen.getByText("You released this handoff.")).toBeInTheDocument();
    expect(screen.getByText("No credits were transferred.")).toBeInTheDocument();
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("6");
  });

  it("does not show terminal overlay when seeker release fails", async () => {
    cancelClaimMock.mockResolvedValue({
      error: "Could not cancel this claim.",
      errorCode: "UNKNOWN",
    });
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <CancelClaimButton claimId={claimId} />
        <HandoffTerminalEndedController />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Release spot" }));
    await user.click(screen.getByRole("radio", { name: "Too far" }));
    const dialog = screen.getByTestId("cancel-claim-confirm");
    await user.click(dialog.querySelector("button[type='submit']") as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText("Could not cancel this claim.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
  });

  it("shows publisher cancel overlay after an authoritative cancel", async () => {
    cancelSpotMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <CancelSpotButton spotId={spotId} claimId={claimId} claimed />
        <HandoffTerminalEndedController />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel handoff" }));
    await user.click(screen.getByRole("radio", { name: "I had to leave" }));
    const dialog = screen.getByTestId("cancel-spot-confirm");
    await user.click(dialog.querySelector("button[type='submit']") as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByTestId("handoff-terminal-overlay")).toBeInTheDocument();
    });
    expect(screen.getByText("Spot cancelled")).toBeInTheDocument();
    expect(screen.getByText("This handoff has ended.")).toBeInTheDocument();
    expect(screen.getByText("No credits were transferred.")).toBeInTheDocument();
  });

  it("does not show terminal overlay when publisher cancel fails", async () => {
    cancelSpotMock.mockResolvedValue({
      error: "Could not cancel this parking spot.",
      errorCode: "UNKNOWN",
    });
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <CancelSpotButton spotId={spotId} claimed />
        <HandoffTerminalEndedController />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel handoff" }));
    await user.click(screen.getByRole("radio", { name: "I had to leave" }));
    const dialog = screen.getByTestId("cancel-spot-confirm");
    await user.click(dialog.querySelector("button[type='submit']") as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getByText("Could not cancel this parking spot."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
  });
});
