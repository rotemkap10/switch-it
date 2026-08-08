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

    expect(screen.getByLabelText("Handoff code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Complete the handoff")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Once you’re safely stopped, enter the code to complete the handoff.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d{5}$/)).not.toBeInTheDocument();

    const form = screen.getByTestId("complete-handoff-form");
    expect(form.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });

  it("asks for a lightweight release confirmation before submitting", async () => {
    const user = userEvent.setup();
    cancelClaimMock.mockResolvedValue({ success: true });

    render(<FeedbackShell><CancelClaimButton claimId={claimId} /></FeedbackShell>);

    expect(screen.getByText("Can’t make it?")).toBeInTheDocument();
    expect(
      screen.getByText("Release the spot so another driver can claim it."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Release spot" }),
    );
    expect(screen.getByText("Release this spot?")).toBeInTheDocument();

    const dialog = screen.getByTestId("cancel-claim-confirm");
    expect(dialog.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });
});
