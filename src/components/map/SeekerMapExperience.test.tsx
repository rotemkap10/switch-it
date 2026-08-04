import { act, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/ParkingMapLoader", () => ({
  ParkingMapLoader: ({
    onVisuallyReady,
  }: {
    onVisuallyReady?: () => void;
  }) => (
    <div data-testid="parking-map">
      <button type="button" onClick={() => onVisuallyReady?.()}>
        Simulate map ready
      </button>
      <div role="status">Loading the map…</div>
    </div>
  ),
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

function renderExperience(
  overrides: Partial<ComponentProps<typeof SeekerMapExperience>> = {},
) {
  return render(
    <SeekerMapExperience
      spots={[]}
      destination={null}
      activeClaim={null}
      showOwnSpotNotice={false}
      spotsError={false}
      activeClaimError={false}
      ownedSpotError={false}
      {...overrides}
    />,
  );
}

describe("SeekerMapExperience overlay hierarchy", () => {
  it("hides empty state and title before the map is visually ready", () => {
    renderExperience({ spots: [] });

    expect(screen.getByTestId("parking-map")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading the map…");
    expect(screen.queryByTestId("map-empty-overlay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("map-title-pill")).not.toBeInTheDocument();
    expect(screen.queryByTestId("own-spot-notice")).not.toBeInTheDocument();
  });

  it("shows a compact empty state only after visual readiness with zero spots", () => {
    renderExperience({ spots: [] });

    act(() => {
      screen.getByRole("button", { name: "Simulate map ready" }).click();
    });

    const empty = screen.getByTestId("map-empty-overlay");
    expect(empty).toHaveTextContent("No spots nearby yet");
    expect(empty).toHaveTextContent("New spots will appear automatically.");
    expect(empty).toHaveTextContent("Share a spot");
    expect(empty.className).toContain("max-w-[20rem]");
    expect(empty.closest(".absolute")).not.toBeNull();
  });

  it("keeps the title pill desktop-only after readiness", () => {
    renderExperience({
      spots: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          latitude: 32.08,
          longitude: 34.78,
          address: null,
          available_at: "2026-08-04T12:45:00.000Z",
          expires_at: "2026-08-04T13:00:00.000Z",
          canClaim: true,
        },
      ],
    });

    act(() => {
      screen.getByRole("button", { name: "Simulate map ready" }).click();
    });

    const title = screen.getByTestId("map-title-pill");
    expect(title.className).toContain("hidden");
    expect(title.className).toContain("md:block");
    expect(title).toHaveTextContent("Find parking");
    expect(title).not.toHaveTextContent("Choose a spot nearby");
  });

  it("prioritizes active claim overlays after readiness", () => {
    renderExperience({
      destination: { latitude: 32.08, longitude: 34.78 },
      activeClaim: claim,
    });

    expect(screen.queryByTestId("active-claim-panel")).not.toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Simulate map ready" }).click();
    });

    expect(screen.getByTestId("active-claim-panel")).toHaveAttribute(
      "data-variant",
      "overlay",
    );
    expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I got the spot" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map-empty-overlay")).not.toBeInTheDocument();
  });

  it("keeps the own-spot notice secondary after readiness", () => {
    renderExperience({
      spots: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          latitude: 32.08,
          longitude: 34.78,
          address: null,
          available_at: "2026-08-04T12:45:00.000Z",
          expires_at: "2026-08-04T13:00:00.000Z",
          canClaim: true,
        },
      ],
      showOwnSpotNotice: true,
    });

    expect(screen.queryByTestId("own-spot-notice")).not.toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Simulate map ready" }).click();
    });

    expect(screen.getAllByTestId("own-spot-notice").length).toBeGreaterThan(0);
  });
});
