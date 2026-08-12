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

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: (options: {
    channelName: string;
    onEvent?: (payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown> | null;
    }) => void;
  }) => {
    if (options.channelName.startsWith("map-claim:") && options.onEvent) {
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
  MapRealtimeSync,
  SEEKER_CLAIM_CANCELLED_BY_PUBLISHER,
} from "@/components/map/MapRealtimeSync";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("MapRealtimeSync cancellation feedback", () => {
  beforeEach(() => {
    infoMock.mockReset();
    scheduleRefreshMock.mockReset();
    claimOnEvent = null;
    clearRealtimeFeedbackSuppression();
  });

  it("toasts once when the publisher cancels even if Realtime delivers twice", () => {
    render(<MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />);

    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });
    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(SEEKER_CLAIM_CANCELLED_BY_PUBLISHER);
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("does not toast when the seeker's own release already suppressed feedback", () => {
    suppressRealtimeFeedback(
      realtimeFeedbackKey("claim", claimId, "cancelled"),
    );

    render(<MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />);

    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(infoMock).not.toHaveBeenCalled();
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });
});
