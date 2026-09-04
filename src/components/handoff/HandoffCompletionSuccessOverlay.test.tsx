import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/spots/new",
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
    prefetch: navigation.prefetch,
    push: vi.fn(),
  }),
  usePathname: () => navigation.pathname,
}));

import { HandoffCompletionSuccessController } from "@/components/handoff/HandoffCompletionSuccessController";
import {
  HANDOFF_COMPLETION_COPY,
  HANDOFF_COMPLETION_OVERLAY_FADE_MS,
  HANDOFF_COMPLETION_SUCCESS_MS,
  peekHandoffCompletionSuccessForTests,
  presentHandoffCompletionSuccess,
  resetHandoffCompletionSuccessForTests,
} from "@/lib/handoff/handoff-completion-success";
import {
  HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS,
  reportSeekerMapPresentation,
  resetSeekerMapPresentationForTests,
} from "@/lib/map/seeker-map-presentation";

const claimId = "11111111-1111-4111-8111-111111111111";

function renderController() {
  return render(<HandoffCompletionSuccessController />);
}

function markFindParkingReady(activeClaimId: string | null = null) {
  reportSeekerMapPresentation({
    visuallyReady: true,
    activeClaimId,
  });
}

function flushOverlayExit() {
  act(() => {
    vi.advanceTimersByTime(HANDOFF_COMPLETION_OVERLAY_FADE_MS);
  });
}

describe("handoff completion success overlay", () => {
  beforeEach(() => {
    resetHandoffCompletionSuccessForTests();
    resetSeekerMapPresentationForTests();
    navigation.pathname = "/spots/new";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    navigation.prefetch.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    resetHandoffCompletionSuccessForTests();
    resetSeekerMapPresentationForTests();
    vi.useRealTimers();
  });

  it("shows publisher +1 credit immediately and starts preparing /map", () => {
    renderController();
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();

    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "publisher" });
    });

    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-role",
      "publisher",
    );
    expect(screen.getByText(HANDOFF_COMPLETION_COPY.publisher.title)).toBeInTheDocument();
    expect(screen.getByTestId("handoff-success-credit")).toHaveTextContent("+1 credit");
    expect(
      screen.getByText(HANDOFF_COMPLETION_COPY.publisher.detail),
    ).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith("/map");
    expect(navigation.prefetch).toHaveBeenCalledWith("/map");
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("shows seeker −1 credit when the seeker observes completion", () => {
    renderController();

    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "seeker" });
    });

    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-role",
      "seeker",
    );
    expect(screen.getByTestId("handoff-success-credit")).toHaveTextContent("−1 credit");
    expect(
      screen.getByText(HANDOFF_COMPLETION_COPY.seeker.detail),
    ).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/map");
  });

  it("does not show success for a duplicate claim event", () => {
    expect(
      presentHandoffCompletionSuccess({ claimId, role: "publisher" }),
    ).toBe(true);
    expect(
      presentHandoffCompletionSuccess({ claimId, role: "publisher" }),
    ).toBe(false);
    expect(
      presentHandoffCompletionSuccess({ claimId, role: "seeker" }),
    ).toBe(false);

    renderController();
    expect(screen.getAllByTestId("handoff-success-overlay")).toHaveLength(1);
    expect(screen.getByTestId("handoff-success-credit")).toHaveTextContent("+1 credit");
  });

  it("does not dismiss the overlay before Find Parking is ready", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "publisher" });
    });
    expect(navigation.replace).toHaveBeenCalledWith("/map");

    act(() => {
      vi.advanceTimersByTime(HANDOFF_COMPLETION_SUCCESS_MS);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(peekHandoffCompletionSuccessForTests()).not.toBeNull();

    act(() => {
      markFindParkingReady();
    });
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
  });

  it("Continue waits for the same map-ready path instead of bypassing it", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "seeker" });
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/map");

    fireEvent.click(screen.getByTestId("handoff-success-continue"));
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(peekHandoffCompletionSuccessForTests()).not.toBeNull();

    act(() => {
      markFindParkingReady();
    });
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
    expect(peekHandoffCompletionSuccessForTests()).toBeNull();
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it("refreshes without replacing when already on /map", () => {
    vi.useFakeTimers();
    navigation.pathname = "/map";
    markFindParkingReady();
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "seeker" });
    });

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(HANDOFF_COMPLETION_SUCCESS_MS);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("keeps the overlay while the completed claim is still on /map", () => {
    vi.useFakeTimers();
    navigation.pathname = "/map";
    markFindParkingReady(claimId);
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "seeker" });
    });

    act(() => {
      vi.advanceTimersByTime(HANDOFF_COMPLETION_SUCCESS_MS);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "false",
    );

    act(() => {
      markFindParkingReady(null);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
  });

  it("falls back so the overlay cannot stay up indefinitely", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "publisher" });
    });

    act(() => {
      vi.advanceTimersByTime(HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS - 1);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "false",
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
  });
});
