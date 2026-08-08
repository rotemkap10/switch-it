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
  }: {
    claimId: string;
    onCompleted?: () => void;
  }) => (
    <form data-testid="complete-handoff-form" data-claim-id={claimId}>
      <button type="button" onClick={() => onCompleted?.()}>
        Verify and complete
      </button>
    </form>
  ),
}));

vi.mock("@/components/ui/HandoffWindowCountdown", () => ({
  HandoffWindowCountdown: ({ role }: { role: string }) => (
    <div data-testid="handoff-window-countdown">{role}</div>
  ),
}));

const forceStopMock = vi.fn();

vi.mock("@/lib/location/use-seeker-live-location-share", () => ({
  useSeekerLiveLocationShare: () => ({
    uiState: "prompt",
    resumedOnce: false,
    startSharing: vi.fn(),
    stopSharing: vi.fn(),
    forceStop: forceStopMock,
  }),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

import {
  ACTIVE_CLAIM_DESTINATION_FALLBACK,
  ActiveClaimPanel,
  activeClaimDestinationLabel,
} from "@/components/map/ActiveClaimPanel";
import { PostClaimNavigationProvider } from "@/components/map/PostClaimNavigationProvider";
import { resetSessionHandoffAnimationForTests } from "@/components/vehicle/useSessionHandoffAnimation";
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
    sessionStore.clear();
    resetSessionHandoffAnimationForTests();
    resetPostClaimNavigationForTests();
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

  it("uses keyboard-safe expanded sheet classes with sticky completion actions", () => {
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

    expect(screen.getByTestId("seeker-share-location")).toBeInTheDocument();
    expect(screen.getByText("Share your live location")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share live location" }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("active-claim-sticky-actions")).toBeInTheDocument();
    expect(screen.getByTestId("complete-handoff-form")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verify and complete" }),
    ).toBeInTheDocument();
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
      screen.queryByTestId("active-claim-sticky-actions"),
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
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verify and complete" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
  });

  it("keeps Open in available when collapsed and hides complete/cancel", async () => {
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
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Verify and complete" }),
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
      screen.getByRole("button", { name: "Verify and complete" }),
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
    expect(
      screen.getByText(ACTIVE_CLAIM_DESTINATION_FALLBACK),
    ).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Release spot" }),
    ).not.toBeInTheDocument();
  });

  it("does not auto-open navigation when an existing claim is loaded", () => {
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
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
    expect(within(sheet).getByText("Spot claimed")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-claim-sheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("complete-handoff-form")).toHaveAttribute(
      "data-claim-id",
      claim.claimId,
    );
    expect(forceStopMock).not.toHaveBeenCalled();
  });

  it("shows Open in for a valid destination and opens the action sheet", async () => {
    const user = userEvent.setup();
    renderPanel(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    await user.click(screen.getByRole("button", { name: "Open in" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Open in")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    const labels = within(dialog)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.slice(0, 3)).toEqual(["Waze", "Google Maps", "Apple Maps"]);
  });

  it("hides Open in when destination coordinates are missing or invalid", () => {
    const { rerender } = renderPanel(
      <ActiveClaimPanel claim={claim} destination={null} />,
    );
    expect(
      screen.queryByRole("button", { name: "Open in" }),
    ).not.toBeInTheDocument();

    rerender(
      <ActiveClaimPanel
        claim={claim}
        destination={{ latitude: 999, longitude: 34.78 }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Open in" }),
    ).not.toBeInTheDocument();
  });

  it("opens Waze with the claimed destination and unchanged payload semantics", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    renderPanel(<ActiveClaimPanel claim={claim} destination={destination} />);

    await user.click(screen.getByRole("button", { name: "Open in" }));
    await user.click(screen.getByRole("button", { name: "Waze" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes&utm_source=switch_it",
      "_blank",
      "noopener,noreferrer",
    );
    expect(forceStopMock).not.toHaveBeenCalled();
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

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Meet the other driver before they pull away so you can take the spot smoothly.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("White SUV")).toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("12-345-67")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-vehicle-animation")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );

    expect(screen.queryByText("Look for this vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("White SUV")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-claim-compact-vehicle")).toHaveTextContent(
      "White SUV · 12-345-67",
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
    expect(screen.getByText("White SUV")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in" })).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Verify and complete" }),
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
      screen.queryByRole("button", { name: "Open in" }),
    ).not.toBeInTheDocument();
  });
});
