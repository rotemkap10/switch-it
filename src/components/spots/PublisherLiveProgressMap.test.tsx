import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PublisherLiveProgressMap } from "@/components/spots/PublisherLiveProgressMap";
import { LIVE_LOCATION_PAUSE_WHILE_NAVIGATING } from "@/lib/location/stale";

vi.mock("@/components/map/BaseMap", () => ({
  BaseMap: () => <div data-testid="base-map" />,
}));

vi.mock("@/lib/map/seekerMapConfig", () => ({
  MAP_SELECTED_SPOT_ZOOM: 16,
  assertMapTilerStyleUrlOrNull: () => "https://example.test/style.json",
}));

const seekerLocation = {
  latitude: 32.086,
  longitude: 34.782,
  accuracyMeters: 10,
  headingDegrees: null,
  sequence: 1,
  sentAt: Date.now(),
};

describe("PublisherLiveProgressMap", () => {
  it("renders destination and seeker when location exists", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={32.0853}
        parkingLongitude={34.7818}
        seekerLocation={seekerLocation}
        statusLabel="Driver location live"
        updatedLabel="Updated just now"
      />,
    );

    const map = screen.getByTestId("publisher-live-progress-map");
    expect(map).toHaveAttribute("data-has-destination", "true");
    expect(map).toHaveAttribute("data-has-seeker", "true");
    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Driver location live",
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Updated just now",
    );
  });

  it("shows paused copy and keeps the last known seeker marker", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={32.0853}
        parkingLongitude={34.7818}
        seekerLocation={seekerLocation}
        statusLabel="Live location paused"
        updatedLabel="Last update 28 seconds ago"
        pauseHint={LIVE_LOCATION_PAUSE_WHILE_NAVIGATING}
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Live location paused",
    );
    expect(screen.getByTestId("publisher-live-pause-hint")).toHaveTextContent(
      LIVE_LOCATION_PAUSE_WHILE_NAVIGATING,
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Last update 28 seconds ago",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
  });

  it("keeps the last marker during delayed updates", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={32.0853}
        parkingLongitude={34.7818}
        seekerLocation={seekerLocation}
        statusLabel="Location update delayed"
        updatedLabel="Updated 14 seconds ago"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Location update delayed",
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Updated 14 seconds ago",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
  });

  it("omits the seeker marker before any location arrives", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={32.0853}
        parkingLongitude={34.7818}
        seekerLocation={null}
        statusLabel="Waiting for driver location"
        updatedLabel="Waiting"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Waiting for driver location",
    );
    expect(screen.queryByTestId("publisher-live-updated")).not.toBeInTheDocument();
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "false",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-destination",
      "true",
    );
  });
});
