import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/ParkingMapLoader", () => ({
  ParkingMapLoader: () => <div data-testid="parking-map">Map surface</div>,
}));

vi.mock("@/components/map/ActiveClaimPanel", () => ({
  ActiveClaimPanel: ({
    variant,
  }: {
    variant?: string;
  }) => (
    <div data-testid="active-claim-panel" data-variant={variant}>
      <button type="button">Navigate</button>
      <button type="button">I got the spot</button>
      <button type="button">I’m no longer coming</button>
    </div>
  ),
}));

vi.mock("@/components/map/OwnSpotNotice", () => ({
  OwnSpotNotice: () => (
    <div data-testid="own-spot-notice">You also have an active parking spot</div>
  ),
}));

import { SeekerMapExperience } from "@/components/map/SeekerMapExperience";

const claim = {
  claimId: "11111111-1111-4111-8111-111111111111",
  claimExpiresAt: "2026-08-04T13:00:00.000Z",
  spotAvailableAt: "2026-08-04T12:45:00.000Z",
  spotAddress: "Rothschild Blvd 1",
};

describe("SeekerMapExperience layout", () => {
  it("keeps the map visible and overlays the empty state", () => {
    render(
      <SeekerMapExperience
        spots={[]}
        destination={null}
        activeClaim={null}
        showOwnSpotNotice={false}
        spotsError={false}
        activeClaimError={false}
        ownedSpotError={false}
      />,
    );

    expect(screen.getByTestId("parking-map")).toBeInTheDocument();
    const empty = screen.getByTestId("map-empty-overlay");
    expect(empty).toHaveTextContent("No spots nearby yet");
    expect(empty.closest(".absolute")).not.toBeNull();
  });

  it("renders active claim actions without replacing the map", () => {
    render(
      <SeekerMapExperience
        spots={[]}
        destination={{ latitude: 32.08, longitude: 34.78 }}
        activeClaim={claim}
        showOwnSpotNotice={false}
        spotsError={false}
        activeClaimError={false}
        ownedSpotError={false}
      />,
    );

    expect(screen.getByTestId("parking-map")).toBeInTheDocument();
    expect(screen.getByTestId("active-claim-panel")).toHaveAttribute(
      "data-variant",
      "overlay",
    );
    expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I got the spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I’m no longer coming" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map-empty-overlay")).not.toBeInTheDocument();
  });

  it("keeps the own-spot notice secondary", () => {
    render(
      <SeekerMapExperience
        spots={[{
          id: "550e8400-e29b-41d4-a716-446655440000",
          latitude: 32.08,
          longitude: 34.78,
          address: null,
          available_at: "2026-08-04T12:45:00.000Z",
          expires_at: "2026-08-04T13:00:00.000Z",
          canClaim: true,
        }]}
        destination={null}
        activeClaim={null}
        showOwnSpotNotice
        spotsError={false}
        activeClaimError={false}
        ownedSpotError={false}
      />,
    );

    const notice = screen.getByTestId("own-spot-notice");
    expect(notice).toHaveTextContent("You also have an active parking spot");
    expect(notice.closest(".absolute")).not.toBeNull();
  });
});
