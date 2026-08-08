import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import {
  buildAppleMapsDirectionsUrl,
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
} from "@/lib/map/navigation-urls";

const destination = {
  latitude: 32.085312,
  longitude: 34.781812,
};

describe("ClaimNavigationActions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ closed: false })),
    );
  });

  it("opens the provider chooser with Waze, Apple Maps, and Google Maps", async () => {
    const user = userEvent.setup();
    render(
      <ClaimNavigationActions
        latitude={destination.latitude}
        longitude={destination.longitude}
      />,
    );

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Navigate" }));

    const sheet = screen.getByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Navigate to spot")).toBeInTheDocument();
    expect(
      within(sheet).getByText("Choose your navigation app."),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    const labels = within(sheet)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.slice(0, 3)).toEqual(["Waze", "Apple Maps", "Google Maps"]);
  });

  it("opens each provider with the claimed spot coordinates", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    render(
      <ClaimNavigationActions
        latitude={destination.latitude}
        longitude={destination.longitude}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildWazeNavigateUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Navigate" }));
    await user.click(screen.getByRole("button", { name: "Apple Maps" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildAppleMapsDirectionsUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Navigate" }));
    await user.click(screen.getByRole("button", { name: "Google Maps" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleMapsDirectionsUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("closes on Cancel without opening a provider", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    render(
      <ClaimNavigationActions
        latitude={destination.latitude}
        longitude={destination.longitude}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not render for invalid coordinates", () => {
    const { container } = render(
      <ClaimNavigationActions latitude={91} longitude={34.78} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
