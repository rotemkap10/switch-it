import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SeekerShareLocationCard } from "@/components/map/SeekerShareLocationCard";

describe("SeekerShareLocationCard", () => {
  it("shows consent before any share action", () => {
    render(
      <SeekerShareLocationCard
        uiState="prompt"
        onShare={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText("Share your live location")).toBeInTheDocument();
    expect(
      screen.getByText(
        /so the parking owner can see you approaching and is more likely to wait/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share live location" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Not now" }),
    ).toBeInTheDocument();
  });

  it("does not call onShare when Not now is pressed", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(
      <SeekerShareLocationCard
        uiState="prompt"
        onShare={onShare}
        onStop={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("seeker-share-not-now"));
    expect(onShare).not.toHaveBeenCalled();
    expect(screen.getByTestId("seeker-share-location")).toHaveAttribute(
      "data-state",
      "dismissed",
    );
  });

  it("shows stop sharing while active", () => {
    render(
      <SeekerShareLocationCard
        uiState="sharing"
        onShare={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText("Sharing live location")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop sharing" }),
    ).toBeInTheDocument();
  });

  it("uses friendly denied copy without browser error codes", () => {
    render(
      <SeekerShareLocationCard
        uiState="denied"
        onShare={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText("Live location is unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/GeolocationPositionError/i)).not.toBeInTheDocument();
  });
});
