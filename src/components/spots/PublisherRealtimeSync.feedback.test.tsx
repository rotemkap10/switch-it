import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infoMock = vi.fn();
const scheduleRefreshMock = vi.fn();
let claimOnEvent:
  | ((payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown> | null;
    }) => void)
  | null = null;
let spotOnEvent:
  | ((payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown> | null;
    }) => void)
  | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/spots/new",
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
    if (
      options.channelName.startsWith("publisher-spot:") &&
      !options.channelName.includes("claims") &&
      options.onEvent
    ) {
      spotOnEvent = options.onEvent;
    }
  },
}));

import {
  clearRealtimeFeedbackSuppression,
  suppressRealtimeFeedback,
  realtimeFeedbackKey,
} from "@/lib/realtime/feedback-suppression";
import { resetHandoffCompletionSuccessForTests } from "@/lib/handoff/handoff-completion-success";
import { resetHandoffTerminalEndedForTests } from "@/lib/handoff/handoff-terminal-ended";
import { HandoffCompletionSuccessController } from "@/components/handoff/HandoffCompletionSuccessController";
import { HandoffTerminalEndedController } from "@/components/handoff/HandoffTerminalEndedController";
import { HeaderCreditsBalance } from "@/components/layout/HeaderCreditsBalance";
import { PublisherRealtimeSync } from "@/components/spots/PublisherRealtimeSync";

const claimId = "11111111-1111-4111-8111-111111111111";
const spotId = "550e8400-e29b-41d4-a716-446655440000";

describe("PublisherRealtimeSync cancellation feedback", () => {
  beforeEach(() => {
    infoMock.mockReset();
    scheduleRefreshMock.mockReset();
    claimOnEvent = null;
    spotOnEvent = null;
    clearRealtimeFeedbackSuppression();
    resetHandoffCompletionSuccessForTests();
    resetHandoffTerminalEndedForTests();
  });

  it("shows seeker-released overlay once when Realtime delivers cancelled twice", () => {
    render(
      <>
        <HeaderCreditsBalance credits={4} />
        <HandoffTerminalEndedController />
        <PublisherRealtimeSync
          userId="owner-1"
          spotId={spotId}
          claimId={claimId}
        />
      </>,
    );

    act(() => {
      claimOnEvent?.({
        new: { id: claimId, status: "cancelled" },
        old: { id: claimId, status: "active" },
      });
      claimOnEvent?.({
        new: { id: claimId, status: "cancelled" },
        old: { id: claimId, status: "active" },
      });
    });

    expect(screen.getAllByTestId("handoff-terminal-overlay")).toHaveLength(1);
    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "seeker_released",
    );
    expect(screen.getByText("Seeker released the spot")).toBeInTheDocument();
    expect(screen.getByText("No credits were transferred.")).toBeInTheDocument();
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("4");
    expect(infoMock).not.toHaveBeenCalled();
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("does not show overlay when the local action already suppressed it", () => {
    suppressRealtimeFeedback(
      realtimeFeedbackKey("claim", claimId, "cancelled"),
    );

    render(
      <>
        <HandoffTerminalEndedController />
        <PublisherRealtimeSync
          userId="owner-1"
          spotId={spotId}
          claimId={claimId}
        />
      </>,
    );

    act(() => {
      claimOnEvent?.({
        new: { id: claimId, status: "cancelled" },
        old: { id: claimId, status: "active" },
      });
    });

    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
    expect(infoMock).not.toHaveBeenCalled();
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("shows expired overlay from an authoritative claim expiry", () => {
    render(
      <>
        <HandoffTerminalEndedController />
        <PublisherRealtimeSync
          userId="owner-1"
          spotId={spotId}
          claimId={claimId}
        />
      </>,
    );

    act(() => {
      claimOnEvent?.({
        new: { id: claimId, status: "expired" },
        old: { id: claimId, status: "active" },
      });
    });

    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "expired",
    );
    expect(screen.getByText("Handoff expired")).toBeInTheDocument();
    expect(infoMock).not.toHaveBeenCalled();
  });

  it("shows expired overlay when an unclaimed listing expires", () => {
    render(
      <>
        <HandoffTerminalEndedController />
        <PublisherRealtimeSync userId="owner-1" spotId={spotId} />
      </>,
    );

    act(() => {
      spotOnEvent?.({
        new: { id: spotId, status: "expired" },
        old: { id: spotId, status: "available" },
      });
    });

    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "expired",
    );
    expect(screen.getByText("The handoff window ended.")).toBeInTheDocument();
  });

  it("shows publisher +1 from Realtime completed without duplicating", () => {
    render(
      <>
        <HandoffCompletionSuccessController />
        <HandoffTerminalEndedController />
        <PublisherRealtimeSync
          userId="owner-1"
          spotId={spotId}
          claimId={claimId}
        />
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
    });

    expect(screen.getAllByTestId("handoff-success-overlay")).toHaveLength(1);
    expect(screen.getByTestId("handoff-success-credit")).toHaveTextContent("+1 credit");
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
    expect(infoMock).not.toHaveBeenCalledWith(
      expect.stringContaining("You earned 1 credit"),
    );
  });
});
