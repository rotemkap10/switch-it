import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const scheduleRefreshMock = vi.fn();

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefreshMock,
}));

import {
  ACTIVE_HANDOFF_RECONCILE_MS,
  useActiveHandoffReconciliation,
} from "@/lib/realtime/use-active-handoff-reconciliation";

function Probe({ enabled }: { enabled: boolean }) {
  useActiveHandoffReconciliation(enabled);
  return null;
}

describe("useActiveHandoffReconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scheduleRefreshMock.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when disabled", () => {
    render(<Probe enabled={false} />);
    vi.advanceTimersByTime(ACTIVE_HANDOFF_RECONCILE_MS + 10);
    expect(scheduleRefreshMock).not.toHaveBeenCalled();
  });

  it("polls while an active handoff is enabled and visible", () => {
    render(<Probe enabled />);
    vi.advanceTimersByTime(ACTIVE_HANDOFF_RECONCILE_MS + 10);
    expect(scheduleRefreshMock).toHaveBeenCalled();
  });

  it("refreshes when the tab becomes visible again", () => {
    render(<Probe enabled />);
    scheduleRefreshMock.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(scheduleRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the network comes back online", () => {
    render(<Probe enabled />);
    scheduleRefreshMock.mockClear();
    window.dispatchEvent(new Event("online"));
    expect(scheduleRefreshMock).toHaveBeenCalledTimes(1);
  });
});
