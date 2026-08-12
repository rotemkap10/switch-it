import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useActiveHandoffReconciliationMock = vi.fn();

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => vi.fn(),
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: () => undefined,
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

  it("does not reconcile while waiting for a claim", () => {
    render(<PublisherRealtimeSync userId="owner-1" spotId="spot-1" />);
    expect(useActiveHandoffReconciliationMock).toHaveBeenCalledWith(false);
  });
});
