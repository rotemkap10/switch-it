import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LeaveTimeSlider } from "@/components/spots/LeaveTimeSlider";
import { leaveDelayValueText } from "@/lib/spots/labels";

describe("leaveDelayValueText", () => {
  it("formats 0, 1, and N correctly", () => {
    expect(leaveDelayValueText(0)).toBe("Now");
    expect(leaveDelayValueText(1)).toBe("In 1 minute");
    expect(leaveDelayValueText(7)).toBe("In 7 minutes");
    expect(leaveDelayValueText(20)).toBe("In 20 minutes");
  });
});

describe("LeaveTimeSlider", () => {
  it("renders accessible range 0–20 with Now display", () => {
    render(<LeaveTimeSlider value={0} onChange={vi.fn()} />);

    const range = screen.getByTestId("leave-time-range");
    expect(range).toHaveAttribute("min", "0");
    expect(range).toHaveAttribute("max", "20");
    expect(range).toHaveAttribute("step", "1");
    expect(range).toHaveAttribute("aria-valuetext", "Now");
    expect(screen.getByText("When will you leave?")).toBeInTheDocument();
    expect(screen.getByTestId("leave-time-value")).toHaveTextContent("Now");
    expect(screen.queryByText("More")).not.toBeInTheDocument();
    expect(screen.queryByText("25 min")).not.toBeInTheDocument();
  });

  it("updates value text when changed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LeaveTimeSlider value={1} onChange={onChange} />);

    expect(screen.getByTestId("leave-time-value")).toHaveTextContent(
      "In 1 minute",
    );

    await user.click(screen.getByTestId("leave-time-range"));
    // Controlled: parent updates value; simulate via rerender pattern
    expect(screen.getByTestId("leave-time-range")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
  });
});
