import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/spots/new",
}));

import { HandoffCompletionSuccessController } from "@/components/handoff/HandoffCompletionSuccessController";
import {
  dismissHandoffCompletionSuccess,
  HANDOFF_COMPLETION_COPY,
  HANDOFF_COMPLETION_SUCCESS_MS,
  peekHandoffCompletionSuccessForTests,
  presentHandoffCompletionSuccess,
  resetHandoffCompletionSuccessForTests,
} from "@/lib/handoff/handoff-completion-success";

const claimId = "11111111-1111-4111-8111-111111111111";

function renderController() {
  return render(<HandoffCompletionSuccessController />);
}

describe("handoff completion success overlay", () => {
  beforeEach(() => {
    resetHandoffCompletionSuccessForTests();
    replaceMock.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    resetHandoffCompletionSuccessForTests();
    vi.useRealTimers();
  });

  it("shows publisher +1 credit only after an authoritative present", () => {
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
    expect(replaceMock).not.toHaveBeenCalled();
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
    expect(replaceMock).not.toHaveBeenCalled();
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
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("Continue navigates to Find Parking immediately", async () => {
    const user = userEvent.setup();
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "seeker" });
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("handoff-success-continue"));
    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
    expect(peekHandoffCompletionSuccessForTests()).toBeNull();
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/map");
  });

  it("automatically navigates to Find Parking after the success delay", () => {
    vi.useFakeTimers();
    renderController();
    act(() => {
      presentHandoffCompletionSuccess({ claimId, role: "publisher" });
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(HANDOFF_COMPLETION_SUCCESS_MS - 1);
    });
    expect(screen.getByTestId("handoff-success-overlay")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId("handoff-success-overlay")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/map");
    dismissHandoffCompletionSuccess();
  });
});
