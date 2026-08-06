import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapUnavailable } from "@/components/map/MapUnavailable";

describe("MapUnavailable", () => {
  it("shows configuration copy without retry", () => {
    render(<MapUnavailable reason="configuration" onRetry={vi.fn()} />);
    expect(screen.getByText("Map is unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/check your configuration/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map-unavailable-retry")).not.toBeInTheDocument();
  });

  it("shows temporary copy with Try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<MapUnavailable reason="temporary" onRetry={onRetry} />);
    expect(
      screen.getByText("Map is temporarily unavailable"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
