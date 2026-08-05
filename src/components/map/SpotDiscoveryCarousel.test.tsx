import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SpotDiscoveryCarousel } from "@/components/map/SpotDiscoveryCarousel";
import type { MapSpot } from "@/types/map-spot";

const now = Date.now();

function spot(overrides: Partial<MapSpot> & Pick<MapSpot, "id">): MapSpot {
  return {
    latitude: 32.0853,
    longitude: 34.7818,
    address: "Arlozorov Street",
    available_at: new Date(now + 5 * 60_000).toISOString(),
    expires_at: new Date(now + 20 * 60_000).toISOString(),
    canClaim: true,
    ...overrides,
  };
}

describe("SpotDiscoveryCarousel", () => {
  it("renders nothing when there are no spots", () => {
    const { container } = render(
      <SpotDiscoveryCarousel
        spots={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders compact cards for available spots", () => {
    render(
      <SpotDiscoveryCarousel
        spots={[
          spot({ id: "a", available_at: new Date(now + 7 * 60_000).toISOString() }),
          spot({
            id: "b",
            available_at: new Date(now - 60_000).toISOString(),
            address: null,
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
        userLocation={{ latitude: 32.0853, longitude: 34.7818 }}
      />,
    );

    expect(
      screen.getByRole("listbox", { name: "Available parking spots" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Available in 7 min")).toBeInTheDocument();
    expect(screen.getByText("Available now")).toBeInTheDocument();
    expect(screen.getByText("Arlozorov Street")).toBeInTheDocument();
    expect(screen.getByText("Parking spot nearby")).toBeInTheDocument();
    expect(screen.getAllByText(/m away|km away/).length).toBeGreaterThan(0);
  });

  it("omits distance when location is unavailable", () => {
    render(
      <SpotDiscoveryCarousel
        spots={[spot({ id: "a" })]}
        selectedId={null}
        onSelect={vi.fn()}
        userLocation={null}
      />,
    );

    expect(screen.queryByText(/away$/)).not.toBeInTheDocument();
  });

  it("hides expired spots", () => {
    render(
      <SpotDiscoveryCarousel
        spots={[
          spot({
            id: "expired",
            expires_at: new Date(now - 60_000).toISOString(),
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("spot-discovery-carousel"),
    ).not.toBeInTheDocument();
  });

  it("exposes selected state and notifies on card click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SpotDiscoveryCarousel
        spots={[spot({ id: "spot-1" }), spot({ id: "spot-2" })]}
        selectedId="spot-2"
        onSelect={onSelect}
      />,
    );

    const selected = screen.getByTestId("spot-carousel-card-spot-2");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByTestId("spot-carousel-card-spot-1"));
    expect(onSelect).toHaveBeenCalledWith("spot-1");
  });
});
