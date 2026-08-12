import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/spots/CancelSpotButton", () => ({
  CancelSpotButton: ({
    spotId,
    claimed,
  }: {
    spotId: string;
    claimed?: boolean;
  }) => (
    <button type="button" data-spot-id={spotId} data-claimed={String(!!claimed)}>
      {claimed ? "I’m leaving" : "Cancel spot"}
    </button>
  ),
}));

vi.mock("@/components/spots/ExtendHandoffWaitButton", () => ({
  ExtendHandoffWaitButton: ({ claimId }: { claimId: string }) => (
    <button type="button" data-testid="extend-handoff-wait" data-claim-id={claimId}>
      Wait 2 more min
    </button>
  ),
}));

vi.mock("@/components/ui/HandoffWindowCountdown", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/ui/HandoffWindowCountdown")
  >("@/components/ui/HandoffWindowCountdown");
  return {
    ...actual,
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
  };
});

vi.mock("@/components/spots/PublisherSpotPreviewMapLoader", () => ({
  PublisherSpotPreviewMapLoader: ({
    latitude,
    longitude,
    variant = "available",
  }: {
    latitude: number;
    longitude: number;
    variant?: "available" | "claimed";
  }) => (
    <div
      data-testid="publisher-spot-preview-map"
      data-latitude={String(latitude)}
      data-longitude={String(longitude)}
      data-preview-variant={variant}
    >
      Map preview
    </div>
  ),
}));

vi.mock("@/components/spots/PublisherLiveProgressMapLoader", () => ({
  PublisherLiveProgressMapLoader: ({
    statusLabel,
    updatedLabel,
    pauseHint,
    progressLabel,
    seekerLocation,
    parkingLatitude,
    parkingLongitude,
  }: {
    statusLabel: string;
    updatedLabel?: string;
    pauseHint?: string | null;
    progressLabel?: string | null;
    seekerLocation?: { latitude: number; longitude: number } | null;
    parkingLatitude: number;
    parkingLongitude: number;
  }) => (
    <div data-testid="publisher-live-progress">
      <p data-testid="publisher-live-status">{statusLabel}</p>
      {progressLabel ? (
        <p data-testid="publisher-driver-distance">{progressLabel}</p>
      ) : null}
      {pauseHint ? (
        <p data-testid="publisher-live-pause-hint">{pauseHint}</p>
      ) : null}
      {updatedLabel && updatedLabel !== "Waiting" ? (
        <p data-testid="publisher-live-updated">{updatedLabel}</p>
      ) : null}
      <div
        data-testid="publisher-live-progress-map"
        data-has-destination="true"
        data-has-seeker={seekerLocation ? "true" : "false"}
        data-parking-lat={String(parkingLatitude)}
        data-parking-lng={String(parkingLongitude)}
      />
    </div>
  ),
}));

type LiveLocationMock = {
  freshness: string;
  statusLabel: string;
  updatedLabel: string;
  pauseHint: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    headingDegrees: number | null;
    sequence: number;
    sentAt: number;
  } | null;
  clear: ReturnType<typeof vi.fn>;
};

const liveLocationState = vi.hoisted(
  (): LiveLocationMock => ({
    freshness: "waiting",
    statusLabel: "Waiting for driver location",
    updatedLabel: "Waiting",
    pauseHint: null,
    location: null,
    clear: vi.fn(),
  }),
);

vi.mock("@/lib/location/use-publisher-live-location", () => ({
  usePublisherLiveLocation: () => ({
    freshness: liveLocationState.freshness,
    statusLabel: liveLocationState.statusLabel,
    updatedLabel: liveLocationState.updatedLabel,
    pauseHint: liveLocationState.pauseHint,
    location: liveLocationState.location,
    lastReceivedAtMs: liveLocationState.location ? Date.now() : null,
    clear: liveLocationState.clear,
  }),
}));

import { LIVE_LOCATION_PAUSE_WHILE_NAVIGATING } from "@/lib/location/stale";
import {
  PUBLISHER_CLAIMED_NEARBY_INSTRUCTION,
  PUBLISHER_CLAIMED_STATUS,
  PUBLISHER_CLAIMED_STAY_INSTRUCTION,
  PUBLISHER_WAITING_STATUS,
  PublisherSpotCard,
  publisherSpotTitleLabel,
} from "@/components/spots/PublisherSpotCard";
import { resetSessionHandoffAnimationForTests } from "@/components/vehicle/useSessionHandoffAnimation";

const baseSpot = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  available_at: "2026-08-04T22:45:00.000Z",
  expires_at: "2026-08-04T22:50:00.000Z",
  address: "Dizengoff 50" as string | null,
  latitude: 32.0853,
  longitude: 34.7818,
};

const seekerVehicle = {
  licensePlate: "7654321",
  make: "Mazda",
  model: "3",
  color: "red" as const,
  type: "hatchback" as const,
};

describe("publisherSpotTitleLabel", () => {
  it("falls back when address is missing", () => {
    expect(publisherSpotTitleLabel(null)).toBe("Exact location marked on map");
    expect(publisherSpotTitleLabel("  ")).toBe("Exact location marked on map");
    expect(publisherSpotTitleLabel("Dizengoff 50")).toBe("Dizengoff 50");
  });
});

describe("PublisherSpotCard", () => {
  const sessionStore = new Map<string, string>();

  beforeEach(() => {
    sessionStore.clear();
    resetSessionHandoffAnimationForTests();
    liveLocationState.freshness = "waiting";
    liveLocationState.statusLabel = "Waiting for driver location";
    liveLocationState.updatedLabel = "Waiting";
    liveLocationState.pauseHint = null;
    liveLocationState.location = null;
    liveLocationState.clear.mockReset();
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
  });

  it("shows waiting copy for an available spot", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available" }}
        layout="page"
      />,
    );

    expect(screen.getByTestId("publisher-spot-card")).toHaveAttribute(
      "data-status",
      "available",
    );
    expect(screen.getByText(PUBLISHER_WAITING_STATUS)).toBeInTheDocument();
    expect(
      screen.queryByText("Your spot is visible to nearby drivers."),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("publisher-spot-preview-map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("publisher-live-progress")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Live$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^claimed$/i)).not.toBeInTheDocument();
  });

  it("shows claimed copy without seeker personal data", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
      />,
    );

    expect(screen.getByText(PUBLISHER_CLAIMED_STATUS)).toBeInTheDocument();
    expect(
      screen.getByText(PUBLISHER_CLAIMED_STAY_INSTRUCTION),
    ).toBeInTheDocument();
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-role",
      "publisher",
    );
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-expires",
      baseSpot.expires_at,
    );
    expect(screen.getByTestId("publisher-parking-address")).toHaveTextContent(
      "Dizengoff 50",
    );
    expect(screen.queryByText("A driver is on the way")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Driver coming$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/seeker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(baseSpot.id)).not.toBeInTheDocument();
  });

  it("does not show a map preview while waiting for a driver", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available" }}
        layout="page"
      />,
    );

    expect(screen.queryByTestId("publisher-spot-preview-map")).not.toBeInTheDocument();
    expect(screen.getByText("Dizengoff 50")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-role",
      "publisher",
    );
    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-expires",
      baseSpot.expires_at,
    );
    expect(screen.getByRole("button", { name: "Cancel spot" })).toBeInTheDocument();
  });

  it("shows Wait 2 more min during the claimed window when headroom remains", () => {
    vi.useFakeTimers({
      now: new Date("2026-08-04T22:46:00.000Z"),
    });
    render(
      <PublisherSpotCard
        spot={{
          ...baseSpot,
          status: "claimed",
          available_at: "2026-08-04T22:45:00.000Z",
          expires_at: "2026-08-04T22:47:00.000Z",
        }}
        activeClaimId="11111111-1111-4111-8111-111111111111"
        layout="page"
      />,
    );

    expect(screen.getByTestId("extend-handoff-wait")).toHaveTextContent(
      "Wait 2 more min",
    );
    expect(
      screen.getByRole("button", { name: "I’m leaving" }),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("hides extension when the handoff is already at the hard cap", () => {
    vi.useFakeTimers({
      now: new Date("2026-08-04T22:46:00.000Z"),
    });
    render(
      <PublisherSpotCard
        spot={{
          ...baseSpot,
          status: "claimed",
          available_at: "2026-08-04T22:45:00.000Z",
          expires_at: "2026-08-04T22:50:00.000Z",
        }}
        activeClaimId="11111111-1111-4111-8111-111111111111"
        layout="page"
      />,
    );

    expect(screen.queryByTestId("extend-handoff-wait")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("uses the address fallback label", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available", address: null }}
        layout="page"
      />,
    );

    expect(screen.getByText("Exact location marked on map")).toBeInTheDocument();
  });

  it("orders claimed glanceable info before code and cancel", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        handoffCode="48291"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    const card = screen.getByTestId("publisher-spot-card");
    const testIds = Array.from(card.querySelectorAll("[data-testid]")).map(
      (element) => element.getAttribute("data-testid"),
    );
    expect(testIds.indexOf("publisher-spot-status")).toBeLessThan(
      testIds.indexOf("handoff-vehicle-section"),
    );
    expect(testIds.indexOf("handoff-vehicle-section")).toBeLessThan(
      testIds.indexOf("publisher-live-progress"),
    );
    expect(testIds.indexOf("publisher-live-progress")).toBeLessThan(
      testIds.indexOf("publisher-parking-context"),
    );
    expect(testIds.indexOf("publisher-parking-context")).toBeLessThan(
      testIds.indexOf("handoff-code-section"),
    );
    expect(screen.getByText("Waiting for driver location")).toBeInTheDocument();
    expect(screen.queryByTestId("publisher-spot-preview-map")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete handoff" }),
    ).not.toBeInTheDocument();
  });

  it("shows the live handoff map only after a seeker claims", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByTestId("publisher-live-progress")).toBeInTheDocument();
    expect(screen.queryByTestId("publisher-spot-preview-map")).not.toBeInTheDocument();
  });

  it("shows seeker vehicle in claimed state", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        handoffCode="48291"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    expect(
      screen.queryByText("Recognize this vehicle when the driver arrives."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("The driver can choose to share their progress."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Give this code to the driver when you meet."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Red · 76-543-21")).toBeInTheDocument();
    expect(screen.getByText("Mazda 3")).toBeInTheDocument();
    expect(screen.getByText("76-543-21")).toBeInTheDocument();
    const identity = screen.getByTestId("vehicle-identity-card");
    expect(within(identity).getByTestId("vehicle-illustration")).toBeInTheDocument();
    expect(within(identity).queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("handoff-vehicle-animation")).toBeInTheDocument();
    expect(screen.getByText("Handoff code")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-code-value")).toHaveTextContent("48291");
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(baseSpot.id)).not.toBeInTheDocument();
  });

  it("does not show the approach animation while waiting for a driver", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        handoffCode="48291"
      />,
    );

    expect(
      screen.queryByTestId("handoff-vehicle-animation"),
    ).not.toBeInTheDocument();
  });

  it("does not show vehicle or code sections for available spots", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        handoffCode="48291"
      />,
    );

    expect(screen.queryByText("Look for this vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("Red · 76-543-21")).not.toBeInTheDocument();
    expect(screen.queryByText("Handoff code")).not.toBeInTheDocument();
  });

  it("shows the seeker photo during an active handoff when one exists", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={{
          ...seekerVehicle,
          photoUrl: "https://example.test/seeker-car.jpg",
        }}
        handoffCode="48291"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    const identity = screen.getByTestId("vehicle-identity-card");
    expect(within(identity).getByTestId("vehicle-photo")).toBeInTheDocument();
    expect(within(identity).getByRole("img", { name: "Mazda 3" })).toHaveAttribute(
      "src",
      "https://example.test/seeker-car.jpg",
    );
    expect(screen.getByText("Mazda 3")).toBeInTheDocument();
    expect(within(identity).queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
  });

  it("shows fallback when seeker vehicle is incomplete", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        activeClaimId="11111111-1111-4111-8111-111111111111"
        counterpartVehicle={{
          licensePlate: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
      />,
    );

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    expect(
      screen.getByText("Vehicle details not added yet"),
    ).toBeInTheDocument();
  });

  it("shows parking context fallback when address is missing", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed", address: null }}
        layout="page"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByTestId("publisher-parking-context")).toBeInTheDocument();
    expect(screen.getByTestId("publisher-parking-address")).toHaveTextContent(
      "Exact location marked on map",
    );
  });

  it("does not give the publisher a seeker Complete action", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        handoffCode="48291"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Complete handoff/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Handoff code")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I’m leaving" }),
    ).toBeInTheDocument();
  });

  it("renders live freshness and keeps last-known progress during pause", () => {
    liveLocationState.freshness = "paused";
    liveLocationState.statusLabel = "Live location paused";
    liveLocationState.updatedLabel = "Last update 28 seconds ago";
    liveLocationState.pauseHint = LIVE_LOCATION_PAUSE_WHILE_NAVIGATING;
    liveLocationState.location = {
      latitude: 32.09114,
      longitude: 34.7818,
      accuracyMeters: 12,
      headingDegrees: null,
      sequence: 4,
      sentAt: Date.now() - 28_000,
    };

    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        activeClaimId="11111111-1111-4111-8111-111111111111"
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
    expect(screen.getByTestId("publisher-driver-distance")).toHaveTextContent(
      /Driver is about \d+ m away/,
    );
  });

  it("renders delayed and unavailable live-location copy", () => {
    liveLocationState.freshness = "delayed";
    liveLocationState.statusLabel = "Location update delayed";
    liveLocationState.updatedLabel = "Updated 14 seconds ago";
    liveLocationState.location = {
      latitude: 32.09114,
      longitude: 34.7818,
      accuracyMeters: 18,
      headingDegrees: null,
      sequence: 3,
      sentAt: Date.now() - 14_000,
    };

    const { rerender } = render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Location update delayed",
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Updated 14 seconds ago",
    );

    liveLocationState.freshness = "unavailable";
    liveLocationState.statusLabel = "Live location temporarily unavailable";
    liveLocationState.updatedLabel = "Last update 28 seconds ago";
    rerender(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Live location temporarily unavailable",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
  });

  it("shifts nearby copy when the seeker is very close", () => {
    liveLocationState.freshness = "live";
    liveLocationState.statusLabel = "Driver location live";
    liveLocationState.updatedLabel = "Updated just now";
    liveLocationState.location = {
      latitude: 32.0856,
      longitude: 34.7818,
      accuracyMeters: 8,
      headingDegrees: null,
      sequence: 6,
      sentAt: Date.now(),
    };

    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        activeClaimId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByTestId("publisher-spot-card")).toHaveAttribute(
      "data-driver-nearby",
      "true",
    );
    expect(
      screen.getByText(PUBLISHER_CLAIMED_NEARBY_INSTRUCTION),
    ).toBeInTheDocument();
    expect(screen.getByTestId("publisher-driver-distance")).toHaveTextContent(
      "Driver is nearby",
    );
    expect(
      screen.queryByRole("button", { name: /Complete handoff/i }),
    ).not.toBeInTheDocument();
  });
});

describe("publisher active-spot gating", () => {
  it("does not render the active card for non-open statuses in isolation", () => {
    // Completed/cancelled/expired spots never become PublisherSpotSummary;
    // the page only mounts this card for available|claimed.
    const { queryByTestId } = render(<div data-testid="publish-form" />);
    expect(queryByTestId("publisher-spot-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("publish-form")).toBeInTheDocument();
  });
});
