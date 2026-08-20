import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const globalsCss = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

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

    const backdrop = await screen.findByTestId("cancel-spot-confirm-backdrop");
    expect(backdrop.className).toContain("cancellation-sheet-backdrop");
    expect(backdrop.className).not.toContain("install-sheet-backdrop");
    expect(backdrop.parentElement).toBe(document.body);

    const dialog = screen.getByTestId("cancel-spot-confirm");
    expect(dialog.className).toContain("cancellation-sheet");
    expect(dialog.className).toContain("motion-soft-scale-in");
    expect(dialog.className).not.toContain("motion-fade-slide-up");
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
    for (const option of options) {
      expect(
        within(dialog).getByRole("radio", { name: option.label }),
      ).toBeInTheDocument();
    }
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

  it("uses the same centered portal presentation for claimed-handoff copy", async () => {
    render(
      <CancellationReasonSheet
        open
        onClose={vi.fn()}
        title="Why are you ending the handoff?"
        options={options}
        selected={null}
        onSelectedChange={vi.fn()}
        formAction={vi.fn()}
        hiddenFields={{ spot_id: "11111111-1111-4111-8111-111111111111" }}
        confirmLabel="End handoff"
        confirmPendingLabel="Cancelling…"
        closeLabel="Keep waiting"
        testId="cancel-handoff-confirm"
      />,
    );

    const backdrop = await screen.findByTestId("cancel-handoff-confirm-backdrop");
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop.className).toContain("cancellation-sheet-backdrop");
    expect(
      within(screen.getByTestId("cancel-handoff-confirm")).getByRole("heading", {
        name: "Why are you ending the handoff?",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the dialog viewport-bounded on short heights (~1584x472)", () => {
    expect(globalsCss).toMatch(
      /\.cancellation-sheet-backdrop\s*\{[^}]*align-items:\s*center/s,
    );
    expect(globalsCss).not.toMatch(
      /\.cancellation-sheet-backdrop\s*\{[^}]*align-items:\s*flex-end/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet\s*\{[^}]*height:\s*min\(max-content,\s*var\(--cancellation-sheet-max-height\)\)/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet\s*\{[^}]*overflow:\s*hidden/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet__form\s*\{[^}]*flex:\s*1\s+1\s+auto/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet__form\s*\{[^}]*min-height:\s*0/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet__reasons\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet__actions\s*\{[^}]*flex-shrink:\s*0/s,
    );
    expect(globalsCss).not.toMatch(
      /\.cancellation-sheet__form\s*\{[^}]*flex:\s*1\s+1\s+0/s,
    );
    expect(globalsCss).not.toMatch(
      /\.cancellation-sheet__reasons\s*\{[^}]*flex:\s*1\s+1\s+0/s,
    );
    expect(globalsCss).not.toMatch(
      /\.cancellation-sheet[^\{]*\{[^}]*top:\s*50%/s,
    );
    expect(globalsCss).not.toMatch(
      /\.cancellation-sheet[^\{]*\{[^}]*translateY\(-50%\)/s,
    );
  });
});
