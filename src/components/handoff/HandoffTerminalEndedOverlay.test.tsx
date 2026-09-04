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

import { HandoffTerminalEndedController } from "@/components/handoff/HandoffTerminalEndedController";
import { HeaderCreditsBalance } from "@/components/layout/HeaderCreditsBalance";
import { HANDOFF_COMPLETION_OVERLAY_FADE_MS } from "@/lib/handoff/handoff-completion-success";
import {
  HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
  HANDOFF_TERMINAL_ENDED_MS,
  peekHandoffTerminalEndedForTests,
  presentHandoffTerminalEnded,
  resetHandoffTerminalEndedForTests,
} from "@/lib/handoff/handoff-terminal-ended";
import { HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS } from "@/lib/map/seeker-map-presentation";
import {
  reportSeekerMapPresentation,
  resetSeekerMapPresentationForTests,
} from "@/lib/map/seeker-map-presentation";

const claimId = "11111111-1111-4111-8111-111111111111";

function renderController() {
  return render(<HandoffTerminalEndedController />);
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

describe("handoff terminal ended overlay", () => {
  beforeEach(() => {
    resetHandoffTerminalEndedForTests();
    resetSeekerMapPresentationForTests();
    navigation.pathname = "/spots/new";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    navigation.prefetch.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    resetHandoffTerminalEndedForTests();
    resetSeekerMapPresentationForTests();
    vi.useRealTimers();
  });

  it("shows publisher cancel copy immediately and starts preparing /map", () => {
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "publisher",
        kind: "publisher_cancelled",
      });
    });

    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "publisher_cancelled",
    );
    expect(screen.getByText("Spot cancelled")).toBeInTheDocument();
    expect(screen.getByText("This handoff has ended.")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-terminal-credit")).toHaveTextContent(
      HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    );
    expect(navigation.replace).toHaveBeenCalledWith("/map");
  });

  it("shows seeker copy when the publisher cancelled", () => {
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "publisher_cancelled",
      });
    });
    expect(screen.getByText("Handoff cancelled")).toBeInTheDocument();
    expect(
      screen.getByText("The publisher cancelled the spot."),
    ).toBeInTheDocument();
  });

  it("shows seeker release copy", () => {
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "seeker_released",
      });
    });
    expect(screen.getByText("Spot released")).toBeInTheDocument();
    expect(screen.getByText("You released this handoff.")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-terminal-credit")).toHaveTextContent(
      HANDOFF_TERMINAL_ENDED_CREDIT_LINE,
    );
  });

  it("shows publisher copy when the seeker released", () => {
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "publisher",
        kind: "seeker_released",
      });
    });
    expect(screen.getByText("Seeker released the spot")).toBeInTheDocument();
    expect(screen.getByText("This handoff has ended.")).toBeInTheDocument();
  });

  it("shows expired copy for both roles", () => {
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "publisher",
        kind: "expired",
      });
    });
    expect(screen.getByText("Handoff expired")).toBeInTheDocument();
    expect(screen.getByText("The handoff window ended.")).toBeInTheDocument();
  });

  it("does not change header credits", () => {
    render(
      <>
        <HeaderCreditsBalance credits={5} />
        <HandoffTerminalEndedController />
      </>,
    );
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("5");
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "expired",
      });
    });
    expect(screen.getByTestId("header-credits-balance")).toHaveTextContent("5");
    expect(screen.getByTestId("header-credits")).not.toHaveClass(
      "motion-credits-update",
    );
  });

  it("does not show a second overlay for a duplicate id", () => {
    expect(
      presentHandoffTerminalEnded({
        id: claimId,
        role: "publisher",
        kind: "publisher_cancelled",
      }),
    ).toBe(true);
    expect(
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "expired",
      }),
    ).toBe(false);
    renderController();
    expect(screen.getAllByTestId("handoff-terminal-overlay")).toHaveLength(1);
    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "publisher_cancelled",
    );
  });

  it("Continue waits for map ready then returns to /map", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "seeker_released",
      });
    });
    expect(navigation.replace).toHaveBeenCalledWith("/map");

    fireEvent.click(screen.getByTestId("handoff-terminal-continue"));
    expect(screen.getByTestId("handoff-terminal-overlay")).toBeInTheDocument();

    act(() => {
      markFindParkingReady();
    });
    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
    expect(peekHandoffTerminalEndedForTests()).toBeNull();
  });

  it("auto-dismisses to /map after the readable dwell once the map is ready", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "publisher",
        kind: "expired",
      });
    });
    act(() => {
      vi.advanceTimersByTime(HANDOFF_TERMINAL_ENDED_MS);
    });
    expect(screen.getByTestId("handoff-terminal-overlay")).toBeInTheDocument();

    act(() => {
      markFindParkingReady();
    });
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
  });

  it("falls back so the overlay cannot stay up indefinitely", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffTerminalEnded({
        id: claimId,
        role: "seeker",
        kind: "publisher_cancelled",
      });
    });
    act(() => {
      vi.advanceTimersByTime(HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS);
    });
    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    flushOverlayExit();
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
  });
});
