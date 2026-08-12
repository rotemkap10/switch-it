import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/map/CancelClaimButton", () => ({
  CancelClaimButton: ({
    claimId,
    onCancelled,
  }: {
    claimId: string;
    onCancelled?: () => void;
  }) => (
    <button
      type="button"
      data-claim-id={claimId}
      onClick={() => onCancelled?.()}
    >
      Release spot
    </button>
  ),
}));

vi.mock("@/components/map/CompleteHandoffForm", () => ({
  CompleteHandoffForm: ({
    claimId,
    onCompleted,
    emphasized,
  }: {
    claimId: string;
    onCompleted?: () => void;
    emphasized?: boolean;
  }) => (
    <form
      data-testid="complete-handoff-form"
      data-claim-id={claimId}
      data-emphasized={emphasized ? "true" : "false"}
    >
      <button type="button" onClick={() => onCompleted?.()}>
        Complete handoff
      </button>
    </form>
  ),
}));

vi.mock("@/components/ui/HandoffWindowCountdown", () => ({
  HandoffWindowCountdown: ({
    role,
    availableAtIso,
    expiresAtIso,
  }: {
    role: string;
    availableAtIso: string;
    expiresAtIso: string;
  }) => (
    <div
      data-testid="handoff-window-countdown"
      data-role={role}
      data-available={availableAtIso}
      data-expires={expiresAtIso}
    >
      {role}
    </div>
  ),
}));

const distanceState = vi.hoisted(() => ({
  label: null as string | null,
  meters: null as number | null,
}));

vi.mock("@/lib/map/use-distance-to-spot", () => ({
  useDistanceToSpot: () => ({
    label: distanceState.label,
    meters: distanceState.meters,
  }),
}));

vi.mock("@/components/spots/PublisherSpotPreviewMapLoader", () => ({
  PublisherSpotPreviewMapLoader: ({
    latitude,
    longitude,
    variant,
    testId = "claim-destination-preview-map",
  }: {
    latitude: number;
    longitude: number;
    variant?: string;
    testId?: string;
  }) => (
    <div
      data-testid={testId}
      data-latitude={String(latitude)}
      data-longitude={String(longitude)}
      data-preview-variant={variant}
    />
  ),
}));

const { forceStopMock, startSharingMock, stopSharingMock, liveShareState } =
  vi.hoisted(() => ({
    forceStopMock: vi.fn(),
    startSharingMock: vi.fn(),
    stopSharingMock: vi.fn(),
    liveShareState: { uiState: "idle" as string },
  }));

vi.mock("@/lib/location/use-seeker-live-location-share", () => ({
  useSeekerLiveLocationShare: () => ({
    uiState: liveShareState.uiState,
    resumedOnce: false,
    startSharing: startSharingMock,
    stopSharing: stopSharingMock,
    forceStop: forceStopMock,
  }),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

import {
  ACTIVE_CLAIM_CLOSE_STATUS,
  ACTIVE_CLAIM_DESTINATION_FALLBACK,
  ACTIVE_CLAIM_ON_WAY_STATUS,
  ActiveClaimPanel,
  activeClaimDestinationLabel,
} from "@/components/map/ActiveClaimPanel";
import { PostClaimNavigationProvider } from "@/components/map/PostClaimNavigationProvider";
import { resetSessionHandoffAnimationForTests } from "@/components/vehicle/useSessionHandoffAnimation";
import { resetSeekerLiveLocationIntentForTests } from "@/lib/location/seeker-live-location-intent";
import {
  offerPostClaimNavigation,
  resetPostClaimNavigationForTests,
} from "@/lib/map/post-claim-navigation";

const claim = {
  claimId: "11111111-1111-4111-8111-111111111111",
  claimExpiresAt: "2026-08-04T13:00:00.000Z",
  spotAvailableAt: "2026-08-04T12:45:00.000Z",
  spotExpiresAt: "2026-08-04T12:50:00.000Z",
  spotAddress: "Rothschild Blvd 1",
};

const destination = {
  latitude: 32.085312,
  longitude: 34.781812,
};

const ownerVehicle = {
  licensePlate: "1234567",
  make: "Hyundai",
  model: "Tucson",
  color: "white" as const,
  type: "suv" as const,
};

describe("activeClaimDestinationLabel", () => {
  it("uses the fallback when address is missing", () => {
    expect(activeClaimDestinationLabel(null)).toBe(
      ACTIVE_CLAIM_DESTINATION_FALLBACK,
    );
    expect(activeClaimDestinationLabel("   ")).toBe(
      ACTIVE_CLAIM_DESTINATION_FALLBACK,
    );
    expect(activeClaimDestinationLabel("Rothschild")).toBe("Rothschild");
  });
});

function renderPanel(ui: ReactElement) {
  const result = render(
    <PostClaimNavigationProvider>{ui}</PostClaimNavigationProvider>,
  );
  return {
    ...result,
    rerender: (next: ReactElement) =>
      result.rerender(
        <PostClaimNavigationProvider>{next}</PostClaimNavigationProvider>,
      ),
  };
}

describe("ActiveClaimPanel sheet UX", () => {
  const sessionStore = new Map<string, string>();

  beforeEach(() => {
    forceStopMock.mockReset();
    startSharingMock.mockReset();
    stopSharingMock.mockReset();
    liveShareState.uiState = "idle";
    distanceState.label = null;
    distanceState.meters = null;
    sessionStore.clear();
    resetSessionHandoffAnimationForTests();
    resetPostClaimNavigationForTests();
    resetSeekerLiveLocationIntentForTests();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionStore.set(key, value);
      },
      removeItem: (key: string) => {
        sessionStore.delete(key);
      },
      clear: () => {
        sessionStore.clear();
      },
      key: () => null,
      length: 0,
    });
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

  it("starts live location sharing as soon as the active claim panel mounts", () => {
    renderPanel(<ActiveClaimPanel claim={claim} destination={destination} />);
    expect(startSharingMock).toHaveBeenCalled();
  });

  it("uses keyboard-safe expanded sheet classes without overlapping sticky actions", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={ownerVehicle}
        variant="overlay"
        expanded
      />,
    );

    const sheet = screen.getByTestId("active-claim-sheet");
    expect(sheet.className).toContain("map-bottom-sheet");
    expect(sheet.className).toContain("map-bottom-sheet--claim-expanded");
    expect(sheet.className).toContain("active-claim-sheet-expanded");
    expect(sheet.className).not.toContain("bottom-28");

    const host = screen.getByTestId("active-claim-overlay-host");
    expect(host.className).toContain("map-bottom-sheet-host");
    expect(host.className).toContain("map-bottom-sheet-host--claim");

    expect(screen.queryByText("Share your live location")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share live location" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();

    expect(screen.getByTestId("active-claim-complete-actions")).toBeInTheDocument();
    expect(screen.getByTestId("complete-handoff-form")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Look for this vehicle")).toHaveLength(1);
    expect(
      screen.queryByText(
        "Meet the other driver before they pull away so you can take the spot smoothly.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /You can still complete the handoff using navigation/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("uses collapsed sheet class without verification UI", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );

    expect(screen.getByTestId("active-claim-sheet").className).toContain(
      "map-bottom-sheet--claim-collapsed",
    );
    expect(
      screen.queryByTestId("active-claim-complete-actions"),
    ).not.toBeInTheDocument();
  });

  it("starts expanded with complete and cancel actions", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    const region = screen.getByRole("region", { name: "Rothschild Blvd 1" });
    expect(region).toHaveAttribute("aria-labelledby");
    expect(region).not.toHaveAttribute("aria-label");
    expect(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Parking spot")).toBeInTheDocument();
    expect(screen.getByTestId("active-claim-address")).toHaveTextContent(
      "Rothschild Blvd 1",
    );
    expect(screen.getByText(ACTIVE_CLAIM_ON_WAY_STATUS)).toBeInTheDocument();
    expect(screen.getByTestId("active-claim-sheet")).toHaveAttribute(
      "data-arrival",
      "en-route",
    );
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-role",
      "seeker",
    );
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-available",
      claim.spotAvailableAt,
    );
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-expires",
      claim.spotExpiresAt,
    );
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
  });

  it("keeps Navigate to spot available when collapsed and hides complete/cancel", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );

    expect(
      screen.getByRole("button", { name: /Expand claim details/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete handoff" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Release spot" }),
    ).not.toBeInTheDocument();
  });

  it("expands again to reveal complete and cancel", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Expand claim details/i }),
    );

    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
  });

  it("uses the destination fallback when address is missing", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={{ ...claim, spotAddress: null }}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(
      screen.getByRole("region", { name: ACTIVE_CLAIM_DESTINATION_FALLBACK }),
    ).toBeInTheDocument();
    expect(screen.getByText("Parking spot")).toBeInTheDocument();
    expect(screen.getByTestId("active-claim-address")).toHaveTextContent(
      ACTIVE_CLAIM_DESTINATION_FALLBACK,
    );
    expect(screen.queryByText(/32\.085/)).not.toBeInTheDocument();
  });

  it("collapses on Escape without removing the claim experience", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Expand claim details/i }),
      ).toHaveAttribute("aria-expanded", "false");
    });
    expect(
      screen.getByRole("region", { name: "Rothschild Blvd 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Release spot" }),
    ).not.toBeInTheDocument();
  });

  it("does not auto-open navigation when an existing claim is loaded", () => {
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
  });

  it("auto-opens the chooser after a fresh claim offer and Cancel keeps the claim", async () => {
    const user = userEvent.setup();
    offerPostClaimNavigation({ claimId: claim.claimId, ...destination });

    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    const sheet = screen.getByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Open in")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByText(
        /Share your live location while you drive to the parking spot/,
      ),
    ).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-claim-sheet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("complete-handoff-form")).toHaveAttribute(
      "data-claim-id",
      claim.claimId,
    );
    expect(forceStopMock).not.toHaveBeenCalled();
  });

  it("shows Navigate to spot for a valid destination and opens the action sheet", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Open in")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();

    const labels = within(dialog)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.slice(0, 3)).toEqual(["Waze", "Google Maps", "Apple Maps"]);
  });

  it("hides Navigate to spot when destination coordinates are missing or invalid", () => {
    const { rerender } = renderPanel(
      <ActiveClaimPanel claim={claim} destination={null} />,
    );
    expect(
      screen.queryByRole("button", { name: "Navigate to spot" }),
    ).not.toBeInTheDocument();

    rerender(
      <ActiveClaimPanel
        claim={claim}
        destination={{ latitude: 999, longitude: 34.78 }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Navigate to spot" }),
    ).not.toBeInTheDocument();
  });

  it("opens Waze, starts live location, and switches to a compact change action", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    renderPanel(<ActiveClaimPanel claim={claim} destination={destination} />);

    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes&utm_source=switch_it",
      "_blank",
      "noopener,noreferrer",
    );
    expect(String(openSpy.mock.calls[0]?.[0])).not.toContain("Rothschild");
    expect(startSharingMock).toHaveBeenCalled();
    expect(forceStopMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Waze · Change" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open in" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Waze · Change" }));
    expect(screen.getByTestId("navigation-provider-sheet")).toBeInTheDocument();
  });

  it("preserves claim ids on complete and cancel actions", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(screen.getByTestId("complete-handoff-form")).toHaveAttribute(
      "data-claim-id",
      claim.claimId,
    );
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toHaveAttribute("data-claim-id", claim.claimId);
  });

  it("shows owner vehicle in expanded state only", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={ownerVehicle}
        variant="overlay"
      />,
    );

    expect(screen.getAllByText("Look for this vehicle")).toHaveLength(1);
    expect(
      screen.queryByText(
        "Meet the other driver before they pull away so you can take the spot smoothly.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("White · 12-345-67")).toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("12-345-67")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-vehicle-animation")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );

    expect(screen.queryByText("Look for this vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("White · 12-345-67")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-claim-compact-vehicle")).toHaveTextContent(
      "Hyundai Tucson · White · 12-345-67",
    );
    expect(
      screen.queryByTestId("handoff-vehicle-animation"),
    ).not.toBeInTheDocument();
  });

  it("does not replay the approach animation on expand and collapse", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={ownerVehicle}
        variant="overlay"
      />,
    );

    expect(screen.getByTestId("handoff-vehicle-animation")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Expand claim details/i }),
    );

    expect(
      screen.queryByTestId("handoff-vehicle-animation"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("White · 12-345-67")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("complete-handoff-form")).toBeInTheDocument();
  });

  it("shows fallback when counterpart vehicle is incomplete", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={{
          licensePlate: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
        variant="overlay"
      />,
    );

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    expect(
      screen.getByText("Vehicle details not added yet"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("omits vehicle section when counterpart vehicle is unavailable", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={null}
        variant="overlay"
      />,
    );

    expect(screen.queryByText("Look for this vehicle")).not.toBeInTheDocument();
  });

  it("navigates with exact coordinates when the display address differs", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    renderPanel(
      <ActiveClaimPanel
        claim={{ ...claim, spotAddress: "Wrong Street 99" }}
        destination={{ latitude: 32.111111, longitude: 34.222222 }}
      />,
    );

    expect(screen.getByTestId("active-claim-address")).toHaveTextContent(
      "Wrong Street 99",
    );
    await user.click(screen.getByRole("button", { name: "Navigate to spot" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://waze.com/ul?ll=32.111111%2C34.222222&navigate=yes&utm_source=switch_it",
      "_blank",
      "noopener,noreferrer",
    );
    expect(String(openSpy.mock.calls[0]?.[0])).not.toContain("Wrong");
  });

  it("shows straight-line distance when seeker location is available", () => {
    distanceState.label = "120 m away";
    distanceState.meters = 120;
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.getByTestId("active-claim-distance")).toHaveTextContent(
      "120 m away",
    );
    expect(screen.getByText(ACTIVE_CLAIM_ON_WAY_STATUS)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
  });

  it("omits distance when seeker location is unavailable and keeps handoff usable", () => {
    distanceState.label = null;
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.queryByTestId("active-claim-distance")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
  });

  it("shows the vehicle photo when a signed URL is available", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={{
          ...ownerVehicle,
          photoUrl: "https://example.test/vehicle.jpg",
        }}
        variant="overlay"
      />,
    );

    const identity = screen.getByTestId("vehicle-identity-card");
    expect(within(identity).getByTestId("vehicle-photo").querySelector("img")).toHaveAttribute(
      "src",
      "https://example.test/vehicle.jpg",
    );
    expect(within(identity).queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("White · 12-345-67")).toBeInTheDocument();
  });

  it("falls back to the vehicle illustration when no photo is available", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={ownerVehicle}
        variant="overlay"
      />,
    );

    const identity = screen.getByTestId("vehicle-identity-card");
    expect(within(identity).getByTestId("vehicle-illustration")).toBeInTheDocument();
    expect(within(identity).queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
  });

  it("renders a compact destination preview with exact parking coordinates", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
        expanded
      />,
    );

    const preview = screen.getByTestId("claim-destination-preview-map");
    expect(preview).toHaveAttribute("data-latitude", String(destination.latitude));
    expect(preview).toHaveAttribute("data-longitude", String(destination.longitude));
    expect(preview).toHaveAttribute("data-preview-variant", "handoff");
  });

  it("still shows the destination preview when the display address is missing", () => {
    renderPanel(
      <ActiveClaimPanel
        claim={{ ...claim, spotAddress: null }}
        destination={destination}
        variant="overlay"
        expanded
      />,
    );

    expect(screen.getByTestId("active-claim-address")).toHaveTextContent(
      ACTIVE_CLAIM_DESTINATION_FALLBACK,
    );
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    const preview = screen.getByTestId("claim-destination-preview-map");
    expect(preview).toHaveAttribute("data-latitude", String(destination.latitude));
    expect(preview).toHaveAttribute("data-longitude", String(destination.longitude));
  });

  it("hides the destination preview when collapsed", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(screen.getByTestId("claim-destination-preview-map")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );
    expect(
      screen.queryByTestId("claim-destination-preview-map"),
    ).not.toBeInTheDocument();
  });

  it("shifts emphasis toward complete when the seeker is very close", async () => {
    const user = userEvent.setup();
    distanceState.label = "40 m away";
    distanceState.meters = 40;
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={ownerVehicle}
        variant="overlay"
      />,
    );

    expect(screen.getByText(ACTIVE_CLAIM_CLOSE_STATUS)).toBeInTheDocument();
    expect(screen.queryByText(ACTIVE_CLAIM_ON_WAY_STATUS)).not.toBeInTheDocument();
    expect(screen.getByTestId("active-claim-sheet")).toHaveAttribute(
      "data-arrival",
      "close",
    );
    expect(screen.getByTestId("complete-handoff-form")).toHaveAttribute(
      "data-emphasized",
      "true",
    );
    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );

    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
  });

  it("renders paused live-location status without blocking the claim", () => {
    liveShareState.uiState = "paused";
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.getByText("Live location paused")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
  });

  it("renders unavailable live-location status without blocking the claim", () => {
    liveShareState.uiState = "unavailable";
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.getByText("Location update delayed")).toBeInTheDocument();
    expect(screen.getByTestId("seeker-share-location-hint")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Navigate to spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
  });

  it("does not offer Stop sharing during an active handoff", () => {
    liveShareState.uiState = "sharing";
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.getByText("Live location on")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });

  it("stops live location share when handoff completes or cancels", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        counterpartVehicle={ownerVehicle}
        variant="overlay"
        expanded
        onExpandedChange={() => {}}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );
    expect(forceStopMock).toHaveBeenCalled();

    forceStopMock.mockClear();
    await user.click(screen.getByRole("button", { name: "Release spot" }));
    expect(forceStopMock).toHaveBeenCalled();
  });
});

describe("active claim experience gating", () => {
  it("does not render the experience without an ActiveClaimPanel", () => {
    render(<div data-testid="available-spot-card" />);
    expect(
      screen.queryByRole("region", { name: ACTIVE_CLAIM_DESTINATION_FALLBACK }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Rothschild Blvd 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Navigate to spot" }),
    ).not.toBeInTheDocument();
  });
});
