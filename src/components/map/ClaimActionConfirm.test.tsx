import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const completeClaimMock = vi.hoisted(() => vi.fn());
const cancelClaimMock = vi.hoisted(() => vi.fn());

vi.mock("@/actions/claims", () => ({
  completeClaim: completeClaimMock,
  cancelClaim: cancelClaimMock,
}));

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { CompleteHandoffForm } from "@/components/map/CompleteHandoffForm";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("claim action confirmations", () => {
  it("shows the handoff code form without revealing the expected code", async () => {
    render(<FeedbackShell><CompleteHandoffForm claimId={claimId} /></FeedbackShell>);

    expect(screen.getByText("Complete the handoff")).toBeInTheDocument();
    expect(
      screen.getByText("Ask the driver for the 5-digit handoff code."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Handoff code")).toBeInTheDocument();
    expect(screen.queryByText(/^\d{5}$/)).not.toBeInTheDocument();

    const form = screen.getByTestId("complete-handoff-form");
    expect(form.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });

  it("asks for a lightweight cancel confirmation before submitting", async () => {
    const user = userEvent.setup();
    cancelClaimMock.mockResolvedValue({ success: true });

    render(<FeedbackShell><CancelClaimButton claimId={claimId} /></FeedbackShell>);

    await user.click(
      screen.getByRole("button", { name: "Cancel handoff" }),
    );
    expect(screen.getByText("Cancel this handoff?")).toBeInTheDocument();

    const dialog = screen.getByTestId("cancel-claim-confirm");
    expect(dialog.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });
});
