import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleRefresh = vi.fn();
const info = vi.fn();
const invalidationCalls: Array<{
  channelName: string;
  enabled?: boolean;
  changes: unknown[];
  onEvent: (payload: unknown) => void;
}> = [];

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefresh,
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info, success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: (options: {
    channelName: string;
    enabled?: boolean;
    changes: unknown[];
    onEvent: (payload: unknown) => void;
  }) => {
    invalidationCalls.push(options);
  },
}));

vi.mock("@/lib/realtime/feedback-suppression", () => ({
  isRealtimeFeedbackSuppressed: () => false,
  realtimeFeedbackKey: (kind: string, id: string, outcome: string) =>
    `${kind}:${id}:${outcome}`,
}));

import { MapRealtimeSync } from "@/components/map/MapRealtimeSync";
import { PublisherRealtimeSync } from "@/components/spots/PublisherRealtimeSync";

describe("MapRealtimeSync", () => {
  beforeEach(() => {
    invalidationCalls.length = 0;
    scheduleRefresh.mockReset();
    info.mockReset();
  });

  it("subscribes to parking_spots and the active claim when present", () => {
    render(<MapRealtimeSync userId="user-1" activeClaimId="claim-1" />);

    const channelNames = invalidationCalls.map((c) => c.channelName);
    expect(channelNames).toContain("map-spots:user-1");
    expect(channelNames).toContain("map-claim:claim-1");

    const spots = invalidationCalls.find(
      (c) => c.channelName === "map-spots:user-1",
    );
    expect(spots?.changes).toEqual([
      expect.objectContaining({ table: "parking_spots", event: "*" }),
    ]);
  });

  it("toasts cancelled claim feedback then refreshes", () => {
    render(<MapRealtimeSync userId="user-1" activeClaimId="claim-1" />);
    const claimSub = invalidationCalls.find(
      (c) => c.channelName === "map-claim:claim-1",
    );
    claimSub?.onEvent({
      new: { id: "claim-1", status: "cancelled" },
      old: { id: "claim-1", status: "active" },
    });
    expect(info).toHaveBeenCalledWith("The parking handoff was cancelled.");
    expect(scheduleRefresh).toHaveBeenCalled();
  });

  it("does not toast for bare parking_spots marker updates", () => {
    render(<MapRealtimeSync userId="user-1" />);
    const spots = invalidationCalls.find(
      (c) => c.channelName === "map-spots:user-1",
    );
    spots?.onEvent({ new: { id: "s1", status: "available" } });
    expect(info).not.toHaveBeenCalled();
    expect(scheduleRefresh).toHaveBeenCalled();
  });
});

describe("PublisherRealtimeSync", () => {
  beforeEach(() => {
    invalidationCalls.length = 0;
    scheduleRefresh.mockReset();
    info.mockReset();
  });

  it("filters parking_spots by owner and claims by id when claimed", () => {
    render(
      <PublisherRealtimeSync
        userId="owner-1"
        spotId="spot-1"
        claimId="claim-9"
      />,
    );

    const spotSub = invalidationCalls.find(
      (c) => c.channelName === "publisher-spot:owner-1",
    );
    expect(spotSub?.changes).toEqual([
      expect.objectContaining({
        table: "parking_spots",
        filter: "owner_id=eq.owner-1",
      }),
    ]);

    const claimSub = invalidationCalls.find(
      (c) => c.channelName === "publisher-claim:claim-9",
    );
    expect(claimSub?.enabled).toBe(true);
    expect(claimSub?.changes).toEqual([
      expect.objectContaining({
        table: "claims",
        filter: "id=eq.claim-9",
      }),
    ]);
  });

  it("shows seeker-cancelled feedback for the publisher", () => {
    render(
      <PublisherRealtimeSync
        userId="owner-1"
        spotId="spot-1"
        claimId="claim-9"
      />,
    );
    const claimSub = invalidationCalls.find(
      (c) => c.channelName === "publisher-claim:claim-9",
    );
    claimSub?.onEvent({
      new: { id: "claim-9", status: "cancelled" },
    });
    expect(info).toHaveBeenCalledWith("The driver is no longer coming.");
    expect(scheduleRefresh).toHaveBeenCalled();
  });
});
