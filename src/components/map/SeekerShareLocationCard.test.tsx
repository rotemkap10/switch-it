import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SeekerShareLocationCard } from "@/components/map/SeekerShareLocationCard";

describe("SeekerShareLocationCard", () => {
  it("renders nothing before sharing has started", () => {
    const { container } = render(
      <SeekerShareLocationCard uiState="idle" onStop={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Share live location")).not.toBeInTheDocument();
    expect(screen.queryByText("Not now")).not.toBeInTheDocument();
  });

  it("does not show a separate consent prompt", () => {
    const { container } = render(
      <SeekerShareLocationCard uiState="prompt" onStop={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Share your live location")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share live location" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();
  });

  it("shows stop sharing while active", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<SeekerShareLocationCard uiState="sharing" onStop={onStop} />);
    expect(screen.getByText("Live location on")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stop sharing" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows paused status with stop sharing", () => {
    render(<SeekerShareLocationCard uiState="paused" onStop={vi.fn()} />);
    expect(screen.getByText("Live location paused")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop sharing" }),
    ).toBeInTheDocument();
  });

  it("shows compact off status without browser error codes", () => {
    render(<SeekerShareLocationCard uiState="denied" onStop={vi.fn()} />);
    expect(screen.getByText("Live location off")).toBeInTheDocument();
    expect(screen.queryByText(/GeolocationPositionError/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });
});
