import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CurrentLocationControl,
  CurrentLocationUnavailableNotice,
} from "@/components/map/CurrentLocationControl";

describe("CurrentLocationControl", () => {
  it("renders with accessible label and icon button", () => {
    render(<CurrentLocationControl onClick={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Center on my location" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("current-location-control")).toBeInTheDocument();
  });

  it("shows pending state and disables duplicate clicks", async () => {
    const user = userEvent.setup();
    render(<CurrentLocationControl onClick={vi.fn()} pending />);

    const button = screen.getByRole("button", { name: /Center on my location/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(button).toBeDisabled();
  });

  it("calls onClick when enabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CurrentLocationControl onClick={onClick} />);

    await user.click(
      screen.getByRole("button", { name: "Center on my location" }),
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders unavailable notice copy", () => {
    render(<CurrentLocationUnavailableNotice />);
    expect(
      screen.getByTestId("current-location-unavailable-notice"),
    ).toHaveTextContent("Current location is unavailable.");
    expect(
      screen.getByTestId("current-location-unavailable-notice"),
    ).toHaveTextContent("You can still move the map manually.");
  });
});
