import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infoMock = vi.fn();
const scheduleRefreshMock = vi.fn();
const notifyTerminalMock = vi.fn();
let claimOnEvent:
  | ((payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown> | null;
    }) => void)
  | null = null;

vi.mock("@/lib/handoff/seeker-handoff-terminal", () => ({
  SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE:
    "This parking spot is no longer available",
  notifySeekerHandoffTerminal: (...args: unknown[]) =>
    notifyTerminalMock(...args),
}));

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
} from "@/components/map/MapRealtimeSync";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("MapRealtimeSync cancellation feedback", () => {
  beforeEach(() => {
    infoMock.mockReset();
    scheduleRefreshMock.mockReset();
    notifyTerminalMock.mockReset();
    claimOnEvent = null;
    clearRealtimeFeedbackSuppression();
  });

  it("notifies terminal once when the publisher cancels even if Realtime delivers twice", () => {
    render(<MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />);

    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });
    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(notifyTerminalMock).toHaveBeenCalledTimes(1);
    expect(notifyTerminalMock).toHaveBeenCalledWith({
      claimId,
      reason: "publisher_cancel",
    });
    expect(infoMock).not.toHaveBeenCalled();
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("does not notify terminal when the seeker's own release already suppressed feedback", () => {
    suppressRealtimeFeedback(
      realtimeFeedbackKey("claim", claimId, "cancelled"),
    );

    render(<MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />);

    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(notifyTerminalMock).not.toHaveBeenCalled();
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("toasts the seeker when the publisher completes the handoff", () => {
    render(<MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />);

    claimOnEvent?.({
      new: { id: claimId, status: "completed" },
      old: { id: claimId, status: "active" },
    });

    expect(infoMock).toHaveBeenCalledWith(
      "Parking handoff complete\n1 credit was used.",
    );
  });
});
