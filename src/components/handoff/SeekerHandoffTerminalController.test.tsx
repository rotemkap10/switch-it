import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infoMock = vi.fn();
const replaceMock = vi.fn();
const clearSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/profile",
}));

vi.mock("@/components/feedback/FeedbackProvider", () => ({
  useFeedback: () => ({ info: infoMock }),
}));

vi.mock("@/components/map/PostClaimNavigationProvider", () => ({
  useOptionalPostClaimNavigation: () => ({
    clearSession: clearSessionMock,
  }),
}));

import {
  notifySeekerHandoffTerminal,
  resetSeekerHandoffTerminalForTests,
  SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE,
} from "@/lib/handoff/seeker-handoff-terminal";
import { SeekerHandoffTerminalController } from "@/components/handoff/SeekerHandoffTerminalController";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("SeekerHandoffTerminalController", () => {
  beforeEach(() => {
    infoMock.mockReset();
    replaceMock.mockReset();
    clearSessionMock.mockReset();
    resetSeekerHandoffTerminalForTests();
  });

  it("shows unavailable copy, clears navigation, and returns to Find parking", async () => {
    render(<SeekerHandoffTerminalController />);

    notifySeekerHandoffTerminal({ claimId, reason: "publisher_cancel" });

    await waitFor(() => {
      expect(infoMock).toHaveBeenCalledWith(
        SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE,
      );
    });
    expect(clearSessionMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/map");
  });

  it("does not toast or navigate for completed terminal events", () => {
    render(<SeekerHandoffTerminalController />);

    notifySeekerHandoffTerminal({ claimId, reason: "completed" });

    expect(infoMock).not.toHaveBeenCalled();
    expect(clearSessionMock).toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
