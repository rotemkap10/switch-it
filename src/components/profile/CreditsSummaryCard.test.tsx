import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreditsSummaryCard } from "@/components/profile/CreditsSummaryCard";
import { resetOneShotAnimationsForTests } from "@/lib/motion/one-shot";

describe("CreditsSummaryCard", () => {
  beforeEach(() => {
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

  it("shows the balance and handoff capacity copy", () => {
    render(<CreditsSummaryCard credits={4} />);

    expect(screen.getByTestId("credits-balance")).toHaveTextContent("4 credits");
    expect(screen.getByText("Enough for 4 parking handoffs")).toBeInTheDocument();
    expect(screen.getByTestId("credits-coin-visual")).toBeInTheDocument();
  });

  it("expands and collapses how credits work", async () => {
    const user = userEvent.setup();
    render(<CreditsSummaryCard credits={1} />);

    const toggle = screen.getByRole("button", { name: /How credits work/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/Use one credit when you receive a spot/i),
    ).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
