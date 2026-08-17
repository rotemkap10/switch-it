import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useActiveHandoffReconciliationMock = vi.fn();
const scheduleRefreshMock = vi.fn();
const onEventHandlers = vi.hoisted(() => ({
  onStatus: {
    spot: null as null | ((status: string) => void),
    spotClaims: null as null | ((status: string) => void),
  },
}));

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefreshMock,
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: (options: {
    channelName: string;
    onSubscriptionStatus?: (status: string) => void;
  }) => {
    if (options.channelName.startsWith("publisher-spot-claims:")) {
      onEventHandlers.onStatus.spotClaims =
        options.onSubscriptionStatus ?? null;
      return;
    }
    if (options.channelName.startsWith("publisher-spot:")) {
      onEventHandlers.onStatus.spot = options.onSubscriptionStatus ?? null;
    }
  },
}));

vi.mock("@/lib/realtime/use-active-handoff-reconciliation", () => ({
  useActiveHandoffReconciliation: (...args: unknown[]) =>
    useActiveHandoffReconciliationMock(...args),
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info: vi.fn() }),
}));

import { PublisherRealtimeSync } from "@/components/spots/PublisherRealtimeSync";

describe("PublisherRealtimeSync", () => {
  beforeEach(() => {
    useActiveHandoffReconciliationMock.mockReset();
    scheduleRefreshMock.mockReset();
    onEventHandlers.onStatus.spot = null;
    onEventHandlers.onStatus.spotClaims = null;
  });

  it("enables handoff reconciliation while a claim is active", () => {
    render(
      <PublisherRealtimeSync
        userId="owner-1"
        spotId="spot-1"
        claimId="claim-1"
      />,
    );
    expect(useActiveHandoffReconciliationMock).toHaveBeenCalledWith(true);
  });

  it("reconciles while waiting for a claim when a spot is open", () => {
    render(<PublisherRealtimeSync userId="owner-1" spotId="spot-1" />);
    expect(useActiveHandoffReconciliationMock).toHaveBeenCalledWith(true);
  });

  it("does not reconcile without an open spot", () => {
    render(<PublisherRealtimeSync userId="owner-1" />);
    expect(useActiveHandoffReconciliationMock).toHaveBeenCalledWith(false);
  });

  it("reconciles on realtime reconnect for spot subscriptions", () => {
    render(<PublisherRealtimeSync userId="owner-1" spotId="spot-1" />);

    act(() => {
      onEventHandlers.onStatus.spot?.("SUBSCRIBED");
    });
    scheduleRefreshMock.mockClear();

    act(() => {
      onEventHandlers.onStatus.spot?.("SUBSCRIBED");
    });
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });
});
