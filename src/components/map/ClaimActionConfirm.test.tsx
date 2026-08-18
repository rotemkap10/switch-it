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
  it("shows plate-digit verification without revealing expected digits", async () => {
    render(<FeedbackShell><CompleteHandoffForm claimId={claimId} /></FeedbackShell>);

    expect(screen.getByText("Confirm the vehicle")).toBeInTheDocument();
    expect(screen.queryByText("Handoff code")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Complete the handoff")).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d{5}$/)).not.toBeInTheDocument();
    expect(screen.queryByText("67")).not.toBeInTheDocument();

    const form = screen.getByTestId("complete-handoff-form");
    expect(form.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });

  it("asks for a lightweight release confirmation before submitting", async () => {
    const user = userEvent.setup();
    cancelClaimMock.mockResolvedValue({ success: true });

    render(<FeedbackShell><CancelClaimButton claimId={claimId} /></FeedbackShell>);

    expect(screen.getByText("Can’t make it?")).toBeInTheDocument();
    const release = screen.getByTestId("cancel-claim-trigger");
    expect(release).toHaveTextContent("Release spot");
    expect(release.className).toContain("border-danger");
    expect(release.className).toContain("min-h-[var(--app-tap-min)]");
    expect(
      screen.queryByText("Release the spot so another driver can claim it."),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Release spot" }),
    );
    expect(screen.getByText("Release this spot?")).toBeInTheDocument();

    const dialog = screen.getByTestId("cancel-claim-confirm");
    expect(dialog.querySelector('input[name="claim_id"]')).toHaveValue(claimId);
  });

  it("renders Complete handoff as a prominent framed primary action", () => {
    render(
      <FeedbackShell>
        <CompleteHandoffForm claimId={claimId} />
      </FeedbackShell>,
    );

    const complete = screen.getByTestId("complete-handoff-submit");
    expect(complete.className).toContain("border-accent");
    expect(complete.className).toContain("border-2");
    expect(complete.className).toContain("min-h-[var(--app-tap-min)]");
  });
});
