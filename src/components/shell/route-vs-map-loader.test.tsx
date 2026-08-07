import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import { PageRouteLoadingChrome } from "@/components/shell/PageRouteLoadingChrome";

describe("route vs embedded map loaders", () => {
  it("keeps the map loader compact after a page shell has rendered", () => {
    render(
      <div>
        <PageRouteLoadingChrome testId="arrived-shell" />
        <div data-testid="map-container" style={{ height: 200 }}>
          <MapLoadingState reducedMotion />
        </div>
      </div>,
    );

    // Destination chrome and embedded map loader can coexist; only one
    // full-page route overlay exists in production (separate provider).
    expect(screen.getByTestId("arrived-shell")).toBeInTheDocument();
    expect(screen.getAllByTestId("branded-loading-pin")).toHaveLength(2);
    expect(screen.getByText("Loading the map…")).toBeInTheDocument();
    expect(screen.getAllByText("Loading…").length).toBeGreaterThanOrEqual(1);

    const mapStatus = screen.getByLabelText("Loading map");
    expect(mapStatus).toHaveAttribute("data-variant", "compact");
  });
});
