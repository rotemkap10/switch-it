import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HeaderCreditsBalance } from "@/components/layout/HeaderCreditsBalance";

describe("HeaderCreditsBalance", () => {
  it("shows the coin icon and current balance", () => {
    render(<HeaderCreditsBalance credits={5} />);

    const indicator = screen.getByTestId("header-credits");
    expect(indicator).toHaveAttribute("aria-label", "5 credits");
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("5");
    expect(indicator.querySelector("svg")).not.toBeNull();
    expect(indicator.textContent).not.toMatch(/🪙/);
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
