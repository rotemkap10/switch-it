import { act, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/ParkingMapLoader", () => ({
  ParkingMapLoader: ({
    onVisuallyReady,
    showDiscoveryCarousel,
    bottomStackOverride,
  }: {
    onVisuallyReady?: () => void;
    showDiscoveryCarousel?: boolean;
    bottomStackOverride?: string | null;
  }) => (
    <div
      data-testid="parking-map"
      data-discovery={showDiscoveryCarousel === false ? "off" : "on"}
      data-bottom-stack={bottomStackOverride ?? "none"}
    >
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
    expanded,
  }: {
    variant?: string;
    expanded?: boolean;
  }) => (
    <div
      data-testid="active-claim-panel"
      data-variant={variant}
      data-expanded={expanded === false ? "false" : "true"}
    >
      <button type="button">Navigate</button>
      <button type="button">Verify and complete</button>
      <button type="button">Release spot</button>
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
  spotExpiresAt: "2026-08-04T12:50:00.000Z",
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
  it("uses a flex-1 absolute-fill map stage without fixed desktop heights", () => {
    const { container } = renderExperience({ spots: [] });

    const stage = screen.getByTestId("seeker-map-stage");
    expect(stage.className).toContain("flex-1");
    expect(stage.className).toContain("min-h-0");
    expect(stage.className).toContain("relative");
    expect(stage.className).not.toMatch(/h-\[\d/);
    expect(stage.className).not.toContain("h-[60vh]");
    expect(stage.className).not.toContain("min-h-[18rem]");
    expect(stage.className).not.toContain("min-h-[24rem]");

    const surface = screen.getByTestId("seeker-map-surface");
    expect(surface.className).toContain("absolute");
    expect(surface.className).toContain("inset-0");
    expect(screen.getByTestId("parking-map").closest("[data-testid='seeker-map-surface']")).not.toBeNull();

    // Overlays must not be in normal document flow before readiness.
    expect(container.querySelector("[data-testid='map-empty-overlay']")).toBeNull();
  });

  it("disables the discovery carousel while an active claim is present", () => {
    renderExperience({
      destination: { latitude: 32.08, longitude: 34.78 },
      activeClaim: claim,
    });

    expect(screen.getByTestId("parking-map")).toHaveAttribute(
      "data-discovery",
      "off",
    );
  });

  it("keeps discovery enabled when browsing without an active claim", () => {
    renderExperience({ spots: [] });
    expect(screen.getByTestId("parking-map")).toHaveAttribute(
      "data-discovery",
      "on",
    );
  });

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
    expect(empty).toHaveTextContent(
      "New spots will appear here automatically.",
    );
    expect(empty).toHaveTextContent("Share a spot");
    expect(empty.className).toContain("map-empty-notice");
    const emptyHost = empty.closest(".absolute");
    expect(emptyHost).not.toBeNull();
    expect(emptyHost?.className).toContain("top-3");
    expect(emptyHost?.className).not.toContain("md:top-14");
    expect(emptyHost?.className).not.toContain("inset-0");
    expect(emptyHost?.className).not.toContain("items-center");
  });

  it("hides own-spot notice while an active claim has priority", () => {
    renderExperience({
      destination: { latitude: 32.08, longitude: 34.78 },
      activeClaim: claim,
      showOwnSpotNotice: true,
    });

    act(() => {
      screen.getByRole("button", { name: "Simulate map ready" }).click();
    });

    expect(screen.getByTestId("active-claim-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("own-spot-notice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("map-empty-overlay")).not.toBeInTheDocument();
  });

  it("passes claim bottom-stack override into the map loader", () => {
    renderExperience({
      destination: { latitude: 32.08, longitude: 34.78 },
      activeClaim: claim,
    });

    expect(screen.getByTestId("parking-map")).toHaveAttribute(
      "data-bottom-stack",
      "claim-expanded",
    );
    expect(screen.getByTestId("seeker-map-stage")).toHaveAttribute(
      "data-map-bottom",
      "claim-expanded",
    );
  });

  it("does not show a redundant Find parking title pill", () => {
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

    expect(screen.queryByTestId("map-title-pill")).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "Verify and complete" }),
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
