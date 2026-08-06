import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LeaveTimeChoices } from "@/components/spots/LeaveTimeChoices";

describe("LeaveTimeChoices", () => {
  it("renders six primary choices in a grid with More collapsed", () => {
    render(
      <LeaveTimeChoices value={0} onChange={vi.fn()} />,
    );

    const grid = screen.getByTestId("leave-time-grid");
    expect(grid.className).toContain("publisher-leave-time-grid");

    for (const label of ["Now", "5 min", "10 min", "15 min", "20 min"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("radio", { name: "25 min" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("reveals 25 and 30 minute options when More is expanded", async () => {
    const user = userEvent.setup();
    render(<LeaveTimeChoices value={0} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("radio", { name: "25 min" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "30 min" })).toBeInTheDocument();
  });

  it("exposes selected state on chips", () => {
    render(<LeaveTimeChoices value={10} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "10 min" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "5 min" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
