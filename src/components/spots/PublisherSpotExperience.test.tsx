import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleRefreshMock = vi.fn();
const onEventHandlers = vi.hoisted(() => ({
  spot: null as null | ((payload: unknown) => void),
  spotClaims: null as null | ((payload: unknown) => void),
  onStatus: {
    spot: null as null | ((status: string) => void),
    spotClaims: null as null | ((status: string) => void),
  },
}));

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefreshMock,
}));

vi.mock("@/lib/realtime/use-active-handoff-reconciliation", () => ({
  useActiveHandoffReconciliation: () => undefined,
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info: vi.fn() }),
}));

vi.mock("@/lib/sensory/feedback", () => ({
  sensoryHandoffCompleted: vi.fn(),
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: (options: {
    channelName: string;
    onEvent?: (payload: unknown) => void;
    onSubscriptionStatus?: (status: string) => void;
  }) => {
    if (options.channelName.startsWith("publisher-spot-claims:")) {
      onEventHandlers.spotClaims = options.onEvent ?? null;
      onEventHandlers.onStatus.spotClaims =
        options.onSubscriptionStatus ?? null;
      return;
    }
    if (options.channelName.startsWith("publisher-spot:")) {
      onEventHandlers.spot = options.onEvent ?? null;
      onEventHandlers.onStatus.spot = options.onSubscriptionStatus ?? null;
    }
  },
}));

vi.mock("@/components/spots/PublisherSpotCard", () => ({
  PUBLISHER_CLAIMED_STATUS: "Driver on the way",
  PUBLISHER_WAITING_STATUS: "Waiting for a driver",
  PublisherSpotCard: ({
    spot,
    activeClaimId,
  }: {
    spot: { status: string; handoff_started_at?: string | null };
    activeClaimId?: string | null;
  }) => (
    <div
      data-testid="publisher-spot-card"
      data-status={spot.status}
      data-claim-id={activeClaimId ?? "none"}
      data-started={spot.handoff_started_at ? "true" : "false"}
    >
      {spot.status === "claimed" ? "Driver on the way" : "Waiting for a driver"}
    </div>
  ),
}));

import { PublisherSpotExperience } from "@/components/spots/PublisherSpotExperience";

const spot = {
  id: "a0a29c9b-3257-4702-aa68-5edeaabe076c",
  status: "available" as const,
  available_at: "2026-08-17T09:00:00.000Z",
  expires_at: "2026-08-17T09:30:00.000Z",
  handoff_started_at: null,
  handoff_extension_used_at: null,
  address: "Test St",
  latitude: 32.1,
  longitude: 34.8,
};

const claimId = "7c611153-191e-430b-940e-ba25e5399571";

describe("PublisherSpotExperience", () => {
  beforeEach(() => {
    scheduleRefreshMock.mockReset();
    onEventHandlers.spot = null;
    onEventHandlers.spotClaims = null;
    onEventHandlers.onStatus.spot = null;
    onEventHandlers.onStatus.spotClaims = null;
  });

  it("starts in waiting state with server available spot", () => {
    render(
      <PublisherSpotExperience
        userId="owner-1"
        spot={spot}
        activeClaimId={null}
      />,
    );
    expect(screen.getByText("Waiting for a driver")).toBeInTheDocument();
  });

  it("transitions immediately when claims INSERT realtime arrives before RSC refresh", () => {
    render(
      <PublisherSpotExperience
        userId="owner-1"
        spot={spot}
        activeClaimId={null}
      />,
    );

    act(() => {
      onEventHandlers.spotClaims?.({
        table: "claims",
        eventType: "INSERT",
        new: { id: claimId, spot_id: spot.id, status: "active" },
        old: {},
      });
    });

    expect(screen.getByText("Driver on the way")).toBeInTheDocument();
    expect(screen.getByTestId("publisher-spot-card")).toHaveAttribute(
      "data-claim-id",
      claimId,
    );
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("does not revert to waiting when stale server props lag behind realtime", () => {
    const { rerender } = render(
      <PublisherSpotExperience
        userId="owner-1"
        spot={spot}
        activeClaimId={null}
      />,
    );

    act(() => {
      onEventHandlers.spotClaims?.({
        table: "claims",
        eventType: "INSERT",
        new: { id: claimId, spot_id: spot.id, status: "active" },
        old: {},
      });
    });

    rerender(
      <PublisherSpotExperience
        userId="owner-1"
        spot={spot}
        activeClaimId={null}
      />,
    );

    expect(screen.getByText("Driver on the way")).toBeInTheDocument();
  });

  it("uses server claim id after RSC refresh catches up", () => {
    const { rerender } = render(
      <PublisherSpotExperience
        userId="owner-1"
        spot={spot}
        activeClaimId={null}
      />,
    );

    act(() => {
      onEventHandlers.spotClaims?.({
        table: "claims",
        eventType: "INSERT",
        new: { id: claimId, spot_id: spot.id, status: "active" },
        old: {},
      });
    });

    rerender(
      <PublisherSpotExperience
        userId="owner-1"
        spot={{ ...spot, status: "claimed" }}
        activeClaimId={claimId}
      />,
    );

    expect(screen.getByTestId("publisher-spot-card")).toHaveAttribute(
      "data-status",
      "claimed",
    );
    expect(screen.getByTestId("publisher-spot-card")).toHaveAttribute(
      "data-claim-id",
      claimId,
    );
  });

  it("applies a start-handoff Realtime UPDATE without crashing while RSC is stale", () => {
    const claimedSpot = { ...spot, status: "claimed" as const };
    render(
      <PublisherSpotExperience
        userId="owner-1"
        spot={claimedSpot}
        activeClaimId={claimId}
      />,
    );

    act(() => {
      onEventHandlers.spot?.({
        table: "parking_spots",
        eventType: "UPDATE",
        new: {
          id: claimedSpot.id,
          status: "claimed",
          handoff_started_at: "2026-08-17T09:01:00.000Z",
          expires_at: "2026-08-17T09:04:00.000Z",
        },
        old: { id: claimedSpot.id, status: "claimed" },
      });
    });

    expect(screen.getByTestId("publisher-spot-card")).toHaveAttribute(
      "data-started",
      "true",
    );
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });
});
