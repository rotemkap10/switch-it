import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infoMock = vi.fn();
const scheduleRefreshMock = vi.fn();
let claimOnEvent:
  | ((payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown> | null;
    }) => void)
  | null = null;

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefreshMock,
}));

vi.mock("@/lib/realtime/use-active-handoff-reconciliation", () => ({
  useActiveHandoffReconciliation: () => undefined,
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info: infoMock }),
}));

vi.mock("@/lib/sensory/feedback", () => ({
  sensoryHandoffCompleted: vi.fn(),
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: (options: {
    channelName: string;
    onEvent?: (payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown> | null;
    }) => void;
  }) => {
    if (options.channelName.startsWith("publisher-claim:") && options.onEvent) {
      claimOnEvent = options.onEvent;
    }
  },
}));

import {
  clearRealtimeFeedbackSuppression,
  suppressRealtimeFeedback,
  realtimeFeedbackKey,
} from "@/lib/realtime/feedback-suppression";
import {
  PUBLISHER_CLAIM_CANCELLED_BY_SEEKER,
  PublisherRealtimeSync,
} from "@/components/spots/PublisherRealtimeSync";

const claimId = "11111111-1111-4111-8111-111111111111";
const spotId = "550e8400-e29b-41d4-a716-446655440000";

describe("PublisherRealtimeSync cancellation feedback", () => {
  beforeEach(() => {
    infoMock.mockReset();
    scheduleRefreshMock.mockReset();
    claimOnEvent = null;
    clearRealtimeFeedbackSuppression();
  });

  it("toasts once when the seeker cancels even if Realtime delivers twice", () => {
    render(
      <PublisherRealtimeSync
        userId="owner-1"
        spotId={spotId}
        claimId={claimId}
      />,
    );

    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });
    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(PUBLISHER_CLAIM_CANCELLED_BY_SEEKER);
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("does not duplicate the cancel toast when the local action already suppressed it", () => {
    suppressRealtimeFeedback(
      realtimeFeedbackKey("claim", claimId, "cancelled"),
    );

    render(
      <PublisherRealtimeSync
        userId="owner-1"
        spotId={spotId}
        claimId={claimId}
      />,
    );

    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(infoMock).not.toHaveBeenCalled();
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });
});
