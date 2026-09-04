import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HeaderCreditsBalance } from "@/components/layout/HeaderCreditsBalance";

describe("HeaderCreditsBalance", () => {
  it("shows the coin icon and current balance", () => {
    render(<HeaderCreditsBalance credits={5} />);

    const indicator = screen.getByTestId("header-credits");
    expect(indicator).toHaveAttribute("aria-label", "5 credits");
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("5");
    expect(screen.getByTestId("coin-stack-icon")).toBeInTheDocument();
    expect(screen.getByTestId("header-credits-balance")).toHaveClass(
      "text-base",
      "font-semibold",
    );
    expect(indicator.querySelector("svg")).toHaveClass("h-6", "w-6");
    expect(indicator.textContent).not.toMatch(/🪙/);
    expect(indicator.innerHTML).not.toMatch(/\$/);
    expect(indicator.querySelector("svg")?.innerHTML).not.toContain("M12 8.2v7.6");
  });

  it("uses singular copy for one credit", () => {
    render(<HeaderCreditsBalance credits={1} />);
    expect(screen.getByTestId("header-credits")).toHaveAttribute(
      "aria-label",
      "1 credit",
    );
  });

  it("shows a quiet placeholder while the balance is unavailable", () => {
    render(<HeaderCreditsBalance credits={null} />);
    expect(screen.getByTestId("header-credits")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("header-credits-balance")).not.toBeInTheDocument();
  });

  it("updates the displayed balance when the shell value changes", () => {
    const { rerender } = render(<HeaderCreditsBalance credits={4} />);
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("4");

    rerender(<HeaderCreditsBalance credits={5} />);
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("5");
  });
});
