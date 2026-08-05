import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { resetOneShotAnimationsForTests } from "@/lib/motion/one-shot";

const { updateDisplayNameMock } = vi.hoisted(() => ({
  updateDisplayNameMock: vi.fn(),
}));

vi.mock("@/actions/profile", () => ({
  updateDisplayName: updateDisplayNameMock,
}));

describe("ProfileForm", () => {
  beforeEach(() => {
    updateDisplayNameMock.mockReset();
    resetOneShotAnimationsForTests();
    vi.stubGlobal("sessionStorage", {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
    });
  });

  it("starts collapsed with the current name and Edit", () => {
    render(
      <FeedbackShell>
        <ProfileForm initialDisplayName="Alex" />
      </FeedbackShell>,
    );

    expect(screen.getByTestId("display-name-summary")).toHaveTextContent("Alex");
    expect(screen.getByTestId("user-initial-avatar")).toHaveAttribute(
      "data-initial",
      "A",
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("expands, cancels, and restores the persisted name", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <ProfileForm initialDisplayName="Alex" />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByTestId("display-name-summary")).toHaveTextContent("Alex");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Display name")).toHaveValue("Alex");
  });

  it("collapses after a successful save", async () => {
    updateDisplayNameMock.mockResolvedValue({
      success: true,
      displayName: "Jordan",
    });
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <ProfileForm initialDisplayName="Alex" />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Jordan");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByTestId("display-name-summary")).toHaveTextContent(
        "Jordan",
      );
    });
  });
});
