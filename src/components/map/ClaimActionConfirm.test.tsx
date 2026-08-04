import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const completeClaimMock = vi.hoisted(() => vi.fn());
const cancelClaimMock = vi.hoisted(() => vi.fn());

vi.mock("@/actions/claims", () => ({
  completeClaim: completeClaimMock,
  cancelClaim: cancelClaimMock,
}));

import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { CompleteClaimButton } from "@/components/map/CompleteClaimButton";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("claim action confirmations", () => {
  it("asks for a lightweight complete confirmation before submitting", async () => {
    const user = userEvent.setup();
    completeClaimMock.mockResolvedValue({ success: true, seekerCredits: 3 });

    render(<CompleteClaimButton claimId={claimId} />);

    expect(screen.queryByText(/Confirm that you received/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I got the spot" }));
    expect(
      screen.getByText("Confirm that you received the parking spot"),
    ).toBeInTheDocument();

    const form = screen.getByText("Confirm that you received the parking spot")
      .closest("form");
    expect(form?.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });

  it("asks for a lightweight cancel confirmation before submitting", async () => {
    const user = userEvent.setup();
    cancelClaimMock.mockResolvedValue({ success: true });

    render(<CancelClaimButton claimId={claimId} />);

    await user.click(
      screen.getByRole("button", { name: "I’m no longer coming" }),
    );
    expect(screen.getByText("Stop heading to this spot?")).toBeInTheDocument();

    const form = screen.getByText("Stop heading to this spot?").closest("form");
    expect(form?.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });
});
