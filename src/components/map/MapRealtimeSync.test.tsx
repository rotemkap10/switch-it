import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleRefreshMock = vi.fn();

vi.mock("@/lib/realtime/use-debounced-router-refresh", () => ({
  useDebouncedRouterRefresh: () => scheduleRefreshMock,
}));

vi.mock("@/lib/realtime/use-realtime-invalidation", () => ({
  useRealtimeInvalidation: () => undefined,
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info: vi.fn() }),
}));

import { MapRealtimeSync } from "@/components/map/MapRealtimeSync";

describe("MapRealtimeSync", () => {
  beforeEach(() => {
    scheduleRefreshMock.mockReset();
  });

  it("refreshes when the tab becomes visible again", () => {
    render(<MapRealtimeSync userId="user-1" />);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(scheduleRefreshMock).toHaveBeenCalledTimes(1);
  });
});
