import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectedSpotCard } from "@/components/map/SelectedSpotCard";
import type { MapSpot } from "@/types/map-spot";

vi.mock("@/components/map/ClaimSpotButton", () => ({
  ClaimSpotButton: ({ spotId }: { spotId: string }) => (
    <button type="button" data-spot-id={spotId}>
      I’m on my way
    </button>
  ),
}));

vi.mock("@/components/ui/Countdown", () => ({
  Countdown: () => <span>Available in 5:00</span>,
}));

const spot: MapSpot = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  latitude: 32.0853,
  longitude: 34.7818,
  address: "Arlozorov Street",
  available_at: "2026-08-04T12:45:00.000Z",
  expires_at: "2026-08-04T13:00:00.000Z",
  canClaim: true,
};

describe("SelectedSpotCard bottom sheet", () => {
  it("renders a labeled sheet with a single claim action", () => {
    render(
      <SelectedSpotCard
        spot={spot}
        onClose={vi.fn()}
        distanceLabel="120 m away"
      />,
    );

    const region = screen.getByRole("region", { name: "Arlozorov Street" });
    expect(region.className).toContain("map-bottom-sheet");
    expect(region.className).toContain("map-bottom-sheet--selected");
    expect(screen.getByText("120 m away")).toBeInTheDocument();
    expect(screen.getByTestId("selected-spot-claim-action")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "I’m on my way" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Close spot details" }),
    ).toBeInTheDocument();
  });

  it("closes back to discovery via the close control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SelectedSpotCard spot={spot} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close spot details" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps host on the shared bottom-sheet contract", () => {
    render(<SelectedSpotCard spot={spot} onClose={vi.fn()} />);
    const host = screen.getByTestId("selected-spot-sheet-host");
    expect(host.className).toContain("map-bottom-sheet-host");
    expect(host.className).not.toContain("bottom-28");
  });
});
