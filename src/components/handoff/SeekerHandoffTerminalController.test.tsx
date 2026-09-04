import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/profile",
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

const infoMock = vi.fn();
const clearSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
    prefetch: navigation.prefetch,
  }),
  usePathname: () => navigation.pathname,
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info: infoMock }),
}));

vi.mock("@/components/map/PostClaimNavigationProvider", () => ({
  useOptionalPostClaimNavigation: () => ({
    clearSession: clearSessionMock,
  }),
}));

import { HandoffTerminalEndedController } from "@/components/handoff/HandoffTerminalEndedController";
import { SeekerHandoffTerminalController } from "@/components/handoff/SeekerHandoffTerminalController";
import { resetHandoffTerminalEndedForTests } from "@/lib/handoff/handoff-terminal-ended";
import {
  notifySeekerHandoffTerminal,
  resetSeekerHandoffTerminalForTests,
} from "@/lib/handoff/seeker-handoff-terminal";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("SeekerHandoffTerminalController", () => {
  beforeEach(() => {
    infoMock.mockReset();
    clearSessionMock.mockReset();
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    navigation.prefetch.mockReset();
    navigation.pathname = "/profile";
    resetSeekerHandoffTerminalForTests();
    resetHandoffTerminalEndedForTests();
  });

  it("shows seeker cancel overlay when the publisher cancels", () => {
    render(
      <>
        <SeekerHandoffTerminalController />
        <HandoffTerminalEndedController />
      </>,
    );

    act(() => {
      notifySeekerHandoffTerminal({ claimId, reason: "publisher_cancel" });
    });

    expect(clearSessionMock).toHaveBeenCalled();
    expect(infoMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "publisher_cancelled",
    );
    expect(screen.getByText("Handoff cancelled")).toBeInTheDocument();
    expect(
      screen.getByText("The publisher cancelled the spot."),
    ).toBeInTheDocument();
    expect(screen.getByText("No credits were transferred.")).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/map");
  });

  it("does not toast or navigate for completed terminal events", () => {
    render(
      <>
        <SeekerHandoffTerminalController />
        <HandoffTerminalEndedController />
      </>,
    );

    notifySeekerHandoffTerminal({ claimId, reason: "completed" });

    expect(infoMock).not.toHaveBeenCalled();
    expect(clearSessionMock).toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("handoff-terminal-overlay")).not.toBeInTheDocument();
  });

  it("shows expired overlay without treating it as success", () => {
    render(
      <>
        <SeekerHandoffTerminalController />
        <HandoffTerminalEndedController />
      </>,
    );

    act(() => {
      notifySeekerHandoffTerminal({ claimId, reason: "expired" });
    });

    expect(infoMock).not.toHaveBeenCalled();
    expect(clearSessionMock).toHaveBeenCalled();
    expect(screen.getByTestId("handoff-terminal-overlay")).toHaveAttribute(
      "data-kind",
      "expired",
    );
    expect(screen.getByText("Handoff expired")).toBeInTheDocument();
    expect(screen.getByText("The handoff window ended.")).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/map");
  });
});
