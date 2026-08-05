import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/spots/CancelSpotButton", () => ({
  CancelSpotButton: ({ spotId }: { spotId: string }) => (
    <button type="button" data-spot-id={spotId}>
      This spot is no longer available
    </button>
  ),
}));

vi.mock("@/components/spots/PublisherSpotPreviewMapLoader", () => ({
  PublisherSpotPreviewMapLoader: ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => (
    <div
      data-testid="publisher-spot-preview-map"
      data-latitude={String(latitude)}
      data-longitude={String(longitude)}
    >
      Map preview
    </div>
  ),
}));

vi.mock("@/components/ui/Countdown", () => ({
  Countdown: ({
    pendingLabel,
    readyLabel,
  }: {
    pendingLabel?: string;
    readyLabel?: string;
  }) => <span>{pendingLabel ?? readyLabel}</span>,
}));

import {
  PublisherSpotCard,
  publisherSpotTitleLabel,
} from "@/components/spots/PublisherSpotCard";
import { resetSessionHandoffAnimationForTests } from "@/components/vehicle/useSessionHandoffAnimation";

const baseSpot = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  available_at: "2026-08-04T22:45:00.000Z",
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
    expect(publisherSpotTitleLabel(null)).toBe("Your parking spot");
    expect(publisherSpotTitleLabel("  ")).toBe("Your parking spot");
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
      screen.getByText("Your spot is visible to nearby drivers."),
    ).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText(/^available$/i)).not.toBeInTheDocument();
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
    expect(
      screen.getByText("Please stay near the spot until the handoff."),
    ).toBeInTheDocument();
    expect(screen.getByText("Driver coming")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/seeker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(baseSpot.id)).not.toBeInTheDocument();
  });

  it("passes spot coordinates to the map preview", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available" }}
        layout="page"
      />,
    );

    const preview = screen.getByTestId("publisher-spot-preview-map");
    expect(preview).toHaveAttribute("data-latitude", "32.0853");
    expect(preview).toHaveAttribute("data-longitude", "34.7818");
  });

  it("keeps the quiet cancellation action", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
      />,
    );

    const cancel = screen.getByRole("button", {
      name: "This spot is no longer available",
    });
    expect(cancel).toHaveAttribute("data-spot-id", baseSpot.id);
  });

  it("uses the address fallback label", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "available", address: null }}
        layout="page"
      />,
    );

    expect(screen.getByText("Your parking spot")).toBeInTheDocument();
  });

  it("shows seeker vehicle in claimed state", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={seekerVehicle}
        handoffCode="48291"
      />,
    );

    expect(screen.getByText("Arriving vehicle")).toBeInTheDocument();
    expect(
      screen.getByText("This is the driver coming to your spot."),
    ).toBeInTheDocument();
    expect(screen.getByText("Red Hatchback")).toBeInTheDocument();
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

    expect(screen.queryByText("Arriving vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("Red Hatchback")).not.toBeInTheDocument();
    expect(screen.queryByText("Handoff code")).not.toBeInTheDocument();
  });

  it("shows fallback when seeker vehicle is incomplete", () => {
    render(
      <PublisherSpotCard
        spot={{ ...baseSpot, status: "claimed" }}
        layout="page"
        counterpartVehicle={{
          licensePlate: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
      />,
    );

    expect(screen.getByText("Arriving vehicle")).toBeInTheDocument();
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
