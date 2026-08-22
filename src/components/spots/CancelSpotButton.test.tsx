import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const cancelSpotMock = vi.hoisted(() => vi.fn());

vi.mock("@/actions/spots", () => ({
  cancelSpot: cancelSpotMock,
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
    expect(trigger.className).toContain("border-accent");
    expect(trigger.className).toContain("w-full");
    expect(trigger.className).toContain("min-h-[var(--app-tap-min)]");
  });

  it("opens publisher reasons for an unclaimed listing and does not submit on close", async () => {
    const user = userEvent.setup();
    render(<CancelSpotButton spotId={spotId} />);

    await user.click(screen.getByRole("button", { name: "Cancel spot" }));

    const dialog = await screen.findByTestId("cancel-spot-confirm");
    expect(
      screen.getByRole("heading", { name: "Why are you cancelling this spot?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Someone else took the spot" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "I had to leave" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Can't complete the handoff" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Too far" })).not.toBeInTheDocument();

    const confirm = within(dialog).getByRole("button", { name: "Cancel spot" });
    expect(confirm).toBeDisabled();
    expect(dialog.querySelector('input[name="spot_id"]')).toHaveValue(spotId);
    expect(dialog.className).toContain("cancellation-sheet");
    expect(dialog.querySelector(".cancellation-sheet__header")).toBeTruthy();
    expect(dialog.querySelector(".cancellation-sheet__reasons")).toBeTruthy();
    expect(dialog.querySelector(".cancellation-sheet__actions")).toBeTruthy();
    expect(dialog.querySelector("fieldset")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      within(dialog).getByRole("button", { name: "Keep spot active" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Other" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep spot active" }));
    expect(screen.queryByTestId("cancel-spot-confirm")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(cancelSpotMock).not.toHaveBeenCalled();
  });

  it("uses Cancel handoff before the live timer starts", async () => {
    const user = userEvent.setup();
    render(<CancelSpotButton spotId={spotId} claimed />);

    const trigger = screen.getByTestId("cancel-spot-trigger");
    expect(trigger).toHaveTextContent("Cancel handoff");

    await user.click(screen.getByRole("button", { name: "Cancel handoff" }));
    expect(
      screen.getByRole("heading", { name: "Why are you ending the handoff?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End handoff" })).toBeDisabled();
  });

  it("uses Leave without handoff after the live timer starts", async () => {
    const user = userEvent.setup();
    render(
      <CancelSpotButton spotId={spotId} claimed handoffStarted />,
    );

    expect(screen.getByTestId("cancel-spot-trigger")).toHaveTextContent(
      "Leave without handoff",
    );

    await user.click(
      screen.getByRole("button", { name: "Leave without handoff" }),
    );
    expect(
      screen.getByRole("heading", { name: "Why are you ending the handoff?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End handoff" })).toBeDisabled();
  });
});
