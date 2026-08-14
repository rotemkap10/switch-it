import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { WEB_HANDOFF_LOCATION_DISCLOSURE } from "@/lib/location/handoff-disclosures";
import { PostClaimNavigationProvider } from "@/components/map/PostClaimNavigationProvider";
import {
  registerSeekerLiveLocationStarter,
  resetSeekerLiveLocationIntentForTests,
} from "@/lib/location/seeker-live-location-intent";
import {
  buildAppleMapsDirectionsUrl,
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
} from "@/lib/map/navigation-urls";
import { resetPostClaimNavigationForTests } from "@/lib/map/post-claim-navigation";

const claimId = "11111111-1111-4111-8111-111111111111";

const destination = {
  latitude: 32.085312,
  longitude: 34.781812,
};

function renderActions() {
  return render(
    <PostClaimNavigationProvider>
      <div className="flex flex-col gap-2">
        <ClaimNavigationActions
          claimId={claimId}
          latitude={destination.latitude}
          longitude={destination.longitude}
          placement="primary"
        />
        <ClaimNavigationActions
          claimId={claimId}
          latitude={destination.latitude}
          longitude={destination.longitude}
          placement="change"
        />
      </div>
    </PostClaimNavigationProvider>,
  );
}

describe("ClaimNavigationActions", () => {
  beforeEach(() => {
    resetPostClaimNavigationForTests();
    resetSeekerLiveLocationIntentForTests();
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

  it("shows a compact Navigate to spot action without auto-opening", () => {
    renderActions();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in" })).not.toBeInTheDocument();
  });

  it("opens the provider chooser with Waze, Google Maps, and Apple Maps", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));

    const sheet = screen.getByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Open in")).toBeInTheDocument();
    expect(
      within(sheet).getByText(WEB_HANDOFF_LOCATION_DISCLOSURE),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();

    const labels = within(sheet)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.slice(0, 3)).toEqual(["Waze", "Google Maps", "Apple Maps"]);
  });

  it("opens each provider and switches to Open in plus a secondary change action", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    renderActions();

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildWazeNavigateUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
    expect(
      screen.getByRole("button", { name: "Open in Waze" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change navigation app" }),
    ).toBeInTheDocument();

    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Change navigation app" }));
    await user.click(screen.getByRole("button", { name: "Google Maps" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleMapsDirectionsUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
    expect(
      screen.getByRole("button", { name: "Open in Google Maps" }),
    ).toBeInTheDocument();

    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Change navigation app" }));
    await user.click(screen.getByRole("button", { name: "Apple Maps" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildAppleMapsDirectionsUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
    expect(
      screen.getByRole("button", { name: "Open in Apple Maps" }),
    ).toBeInTheDocument();
  });

  it("keeps Navigate to spot after Dismiss and can reopen the chooser", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    expect(screen.getByTestId("navigation-provider-sheet")).toBeInTheDocument();
  });

  it("still opens navigation when live location start fails", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    registerSeekerLiveLocationStarter(() => {
      throw new Error("geolocation denied");
    });
    renderActions();

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));

    expect(openSpy).toHaveBeenCalledWith(
      buildWazeNavigateUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
    expect(
      screen.getByRole("button", { name: "Open in Waze" }),
    ).toBeInTheDocument();
  });

  it("relaunches the selected provider from the primary Open in action", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    renderActions();

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));
    openSpy.mockClear();

    await user.click(screen.getByRole("button", { name: "Open in Waze" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildWazeNavigateUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
  });

  it("does not render for invalid coordinates", () => {
    const { container } = render(
      <PostClaimNavigationProvider>
        <ClaimNavigationActions claimId={claimId} latitude={91} longitude={34.78} />
      </PostClaimNavigationProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
