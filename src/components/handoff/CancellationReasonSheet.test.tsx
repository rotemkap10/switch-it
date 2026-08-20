import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CancellationReasonSheet } from "@/components/handoff/CancellationReasonSheet";

const options = [
  { value: "someone_else_took_spot", label: "Someone else took the spot" },
  { value: "had_to_leave", label: "I had to leave" },
  { value: "cant_complete_handoff", label: "Can't complete the handoff" },
  { value: "other", label: "Other" },
] as const;

describe("CancellationReasonSheet layout", () => {
  it("keeps header, scrollable reasons, and in-flow footer as siblings", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelectedChange = vi.fn();

    render(
      <CancellationReasonSheet
        open
        onClose={onClose}
        title="Why are you cancelling this spot?"
        options={options}
        selected={null}
        onSelectedChange={onSelectedChange}
        formAction={vi.fn()}
        hiddenFields={{ spot_id: "11111111-1111-4111-8111-111111111111" }}
        confirmLabel="Cancel spot"
        confirmPendingLabel="Cancelling…"
        closeLabel="Keep spot active"
        testId="cancel-spot-confirm"
      />,
    );

    const dialog = screen.getByTestId("cancel-spot-confirm");
    expect(dialog.className).toContain("cancellation-sheet");
    expect(dialog.querySelector(".cancellation-sheet__header")).toBeTruthy();
    expect(dialog.querySelector("fieldset")).toBeNull();

    const reasons = dialog.querySelector(".cancellation-sheet__reasons");
    const actions = dialog.querySelector(".cancellation-sheet__actions");
    expect(reasons).toBeTruthy();
    expect(actions).toBeTruthy();
    expect(reasons?.contains(actions)).toBe(false);

    expect(
      within(dialog).getByRole("heading", {
        name: "Why are you cancelling this spot?",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Other" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Keep spot active" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel spot" }),
    ).toBeDisabled();

    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByRole("button", { name: "Keep spot active" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
