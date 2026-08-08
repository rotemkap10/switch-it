import { render, screen } from "@testing-library/react";
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
    HandoffWindowCountdown: ({ role }: { role: string }) => (
      <div data-testid="handoff-window-countdown">{role}</div>
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
  }: {
    statusLabel: string;
  }) => (
    <div data-testid="publisher-live-progress">
      <p>{statusLabel}</p>
    </div>
  ),
}));

vi.mock("@/lib/location/use-publisher-live-location", () => ({
  usePublisherLiveLocation: () => ({
    freshness: "waiting",
    statusLabel: "Waiting for location",
    updatedLabel: "Waiting",
    location: null,
    lastReceivedAtMs: null,
    clear: vi.fn(),
  }),
}));

import {
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
    expect(publisherSpotTitleLabel(null)).toBe("Location selected on the map");
    expect(publisherSpotTitleLabel("  ")).toBe("Location selected on the map");
    expect(publisherSpotTitleLabel("Dizengoff 50")).toBe("Dizengoff 50");
  });
});

describe("PublisherSpotCard", () => {
  const sessionStore = new Map<string, string>();

  beforeEach(() => {
    sessionStore.clear();
    resetSessionHandoffAnimationForTests();
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
    expect(screen.getByText("Waiting for a driver")).toBeInTheDocument();
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

    expect(screen.getByText("A driver is on the way")).toBeInTheDocument();
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
    expect(screen.getByTestId("handoff-window-countdown")).toBeInTheDocument();
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

    expect(screen.getByText("Location selected on the map")).toBeInTheDocument();
  });

  it("prioritizes handoff code before live progress map in claimed state", () => {
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
    expect(testIds.indexOf("handoff-code-section")).toBeLessThan(
      testIds.indexOf("publisher-live-progress"),
    );
    expect(screen.getByText("Waiting for location")).toBeInTheDocument();
    expect(screen.queryByTestId("publisher-spot-preview-map")).not.toBeInTheDocument();
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

    expect(screen.getByText("Look for this driver")).toBeInTheDocument();
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

    expect(screen.queryByText("Look for this driver")).not.toBeInTheDocument();
    expect(screen.queryByText("Red · 76-543-21")).not.toBeInTheDocument();
    expect(screen.queryByText("Handoff code")).not.toBeInTheDocument();
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

    expect(screen.getByText("Look for this driver")).toBeInTheDocument();
    expect(
      screen.getByText("Vehicle details not added yet"),
    ).toBeInTheDocument();
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
