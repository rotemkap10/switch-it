import { act, render, screen } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/map",
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
  presentHandoffCompletionSuccess,
  resetHandoffCompletionSuccessForTests,
} from "@/lib/handoff/handoff-completion-success";
import { HandoffCompletionSuccessController } from "@/components/handoff/HandoffCompletionSuccessController";
import { HeaderCreditsBalance } from "@/components/layout/HeaderCreditsBalance";
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
    resetHandoffCompletionSuccessForTests();
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

  it("notifies expiry without a toast", () => {
    render(<MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />);

    claimOnEvent?.({
      new: { id: claimId, status: "expired" },
      old: { id: claimId, status: "active" },
    });

    expect(notifyTerminalMock).toHaveBeenCalledWith({
      claimId,
      reason: "expired",
    });
    expect(infoMock).not.toHaveBeenCalled();
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

  it("shows the seeker −1 overlay when the publisher completes the handoff", () => {
    const { rerender } = render(
      <>
        <HeaderCreditsBalance credits={5} />
        <HandoffCompletionSuccessController />
        <MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />
      </>,
    );

    act(() => {
      claimOnEvent?.({
        new: { id: claimId, status: "completed" },
        old: { id: claimId, status: "active" },
      });
    });

    expect(notifyTerminalMock).toHaveBeenCalledWith({
      claimId,
      reason: "completed",
    });
    expect(infoMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-role",
      "seeker",
    );
    expect(screen.getByTestId("handoff-success-credit")).toHaveTextContent("−1 credit");

    rerender(
      <>
        <HeaderCreditsBalance credits={4} />
        <HandoffCompletionSuccessController />
        <MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />
      </>,
    );
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("4");
  });

  it("does not show success until the claim is completed", () => {
    render(
      <>
        <HandoffCompletionSuccessController />
        <MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />
      </>,
    );

    claimOnEvent?.({
      new: { id: claimId, status: "active" },
      old: { id: claimId, status: "active" },
    });
    claimOnEvent?.({
      new: { id: claimId, status: "cancelled" },
      old: { id: claimId, status: "active" },
    });

    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
    expect(screen.queryByText("−1 credit")).not.toBeInTheDocument();
  });

  it("does not re-show success when Realtime delivers completed twice", () => {
    render(
      <>
        <HandoffCompletionSuccessController />
        <MapRealtimeSync userId="seeker-1" activeClaimId={claimId} />
      </>,
    );

    act(() => {
      claimOnEvent?.({
        new: { id: claimId, status: "completed" },
        old: { id: claimId, status: "active" },
      });
      claimOnEvent?.({
        new: { id: claimId, status: "completed" },
        old: { id: claimId, status: "active" },
      });
      presentHandoffCompletionSuccess({ claimId, role: "seeker" });
    });

    expect(screen.getAllByTestId("handoff-success-overlay")).toHaveLength(1);
    expect(notifyTerminalMock).toHaveBeenCalledTimes(1);
  });
});
