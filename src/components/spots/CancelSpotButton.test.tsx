import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/spots", () => ({
  cancelSpot: vi.fn(),
}));

vi.mock("@/components/feedback/useActionFeedback", () => ({
  useActionFeedback: () => {},
}));

vi.mock("@/lib/realtime/use-suppress-realtime-on-success", () => ({
  realtimeFeedbackKey: () => "key",
  useSuppressRealtimeOnSuccess: () => {},
}));

import { CancelSpotButton } from "@/components/spots/CancelSpotButton";

const spotId = "11111111-1111-4111-8111-111111111111";

describe("CancelSpotButton", () => {
  it("renders Cancel spot as a full-width outlined danger button", () => {
    render(<CancelSpotButton spotId={spotId} />);

    const trigger = screen.getByTestId("cancel-spot-trigger");
    expect(trigger).toHaveTextContent("Cancel spot");
    expect(trigger.className).toContain("border-danger");
    expect(trigger.className).toContain("w-full");
    expect(trigger.className).toContain("min-h-[var(--app-tap-min)]");
    expect(trigger.className).not.toContain("underline");
  });

  it("keeps Keep spot active primary and Cancel spot as outlined secondary in confirm", async () => {
    const user = userEvent.setup();
    render(<CancelSpotButton spotId={spotId} />);

    await user.click(screen.getByRole("button", { name: "Cancel spot" }));

    const dialog = screen.getByTestId("cancel-spot-confirm");
    const keep = screen.getByRole("button", { name: "Keep spot active" });
    const cancel = screen.getByRole("button", { name: "Cancel spot" });

    expect(dialog).toContainElement(keep);
    expect(dialog).toContainElement(cancel);
    expect(keep.className).toContain("border-border");
    expect(cancel.className).toContain("border-danger");
    expect(keep.className).toContain("w-full");
    expect(cancel.className).toContain("w-full");
  });

  it("uses Cancel handoff before the live timer starts", async () => {
    const user = userEvent.setup();
    render(<CancelSpotButton spotId={spotId} claimed />);

    const trigger = screen.getByTestId("cancel-spot-trigger");
    expect(trigger).toHaveTextContent("Cancel handoff");
    expect(trigger).not.toHaveTextContent("I’m leaving");

    await user.click(screen.getByRole("button", { name: "Cancel handoff" }));
    expect(screen.getByText("Cancel this handoff?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel handoff" }),
    ).toBeInTheDocument();
  });

  it("uses Leave without handoff after the live timer starts", async () => {
    const user = userEvent.setup();
    render(
      <CancelSpotButton spotId={spotId} claimed handoffStarted />,
    );

    expect(screen.getByTestId("cancel-spot-trigger")).toHaveTextContent(
      "Leave without handoff",
    );
    expect(
      screen.queryByRole("button", { name: "I’m leaving" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Leave without handoff" }),
    );
    expect(screen.getByText("Leave without a handoff?")).toBeInTheDocument();
  });
});
