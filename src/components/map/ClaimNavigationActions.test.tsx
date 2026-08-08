import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import {
  buildAppleMapsDirectionsUrl,
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
} from "@/lib/map/navigation-urls";
import {
  offerPostClaimNavigation,
  resetPostClaimNavigationForTests,
} from "@/lib/map/post-claim-navigation";

const claimId = "11111111-1111-4111-8111-111111111111";

const destination = {
  latitude: 32.085312,
  longitude: 34.781812,
};

function renderActions() {
  return render(
    <ClaimNavigationActions
      claimId={claimId}
      latitude={destination.latitude}
      longitude={destination.longitude}
    />,
  );
}

describe("ClaimNavigationActions", () => {
  beforeEach(() => {
    resetPostClaimNavigationForTests();
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

  it("does not auto-open for an existing claim without a fresh success offer", () => {
    renderActions();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
  });

  it("auto-opens the chooser once after a successful claim offer", () => {
    offerPostClaimNavigation(claimId);
    renderActions();

    const sheet = screen.getByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Spot claimed")).toBeInTheDocument();
    expect(
      within(sheet).queryByText("Choose an app to navigate to the handoff."),
    ).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    const labels = within(sheet)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.slice(0, 3)).toEqual(["Waze", "Google Maps", "Apple Maps"]);
  });

  it("does not reopen on rerender after the post-claim chooser was shown", () => {
    offerPostClaimNavigation(claimId);
    const { rerender } = renderActions();
    expect(screen.getByTestId("navigation-provider-sheet")).toBeInTheDocument();

    rerender(
      <ClaimNavigationActions
        claimId={claimId}
        latitude={destination.latitude}
        longitude={destination.longitude}
      />,
    );
    expect(screen.getByTestId("navigation-provider-sheet")).toBeInTheDocument();
  });

  it("dismisses with Cancel without opening a provider and keeps Open in", async () => {
    const user = userEvent.setup();
    offerPostClaimNavigation(claimId);
    const openSpy = vi.mocked(window.open);
    renderActions();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not auto-open again after Cancel, even on remount", async () => {
    const user = userEvent.setup();
    offerPostClaimNavigation(claimId);
    const { unmount } = renderActions();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    unmount();

    renderActions();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
  });

  it("reopens the same chooser from Open in after dismissal", async () => {
    const user = userEvent.setup();
    offerPostClaimNavigation(claimId);
    renderActions();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Open in" }));

    const sheet = screen.getByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Open in")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });

  it("opens the provider chooser with Waze, Google Maps, and Apple Maps", async () => {
    const user = userEvent.setup();
    renderActions();

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open in" }));

    const sheet = screen.getByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Open in")).toBeInTheDocument();
    expect(
      within(sheet).queryByText("Choose an app to navigate to the handoff."),
    ).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    const labels = within(sheet)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.slice(0, 3)).toEqual(["Waze", "Google Maps", "Apple Maps"]);
  });

  it("opens each provider with the claimed spot coordinates", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    renderActions();

    await user.click(screen.getByRole("button", { name: "Open in" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildWazeNavigateUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Open in" }));
    await user.click(screen.getByRole("button", { name: "Google Maps" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleMapsDirectionsUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Open in" }));
    await user.click(screen.getByRole("button", { name: "Apple Maps" }));
    expect(openSpy).toHaveBeenCalledWith(
      buildAppleMapsDirectionsUrl(destination.latitude, destination.longitude),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("does not render for invalid coordinates", () => {
    const { container } = render(
      <ClaimNavigationActions claimId={claimId} latitude={91} longitude={34.78} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores an offer for a different claim id", () => {
    offerPostClaimNavigation("33333333-3333-4333-8333-333333333333");
    renderActions();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
  });
});
