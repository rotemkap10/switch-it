import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { ActiveClaimPanel } from "@/components/map/ActiveClaimPanel";
import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";
import { PostClaimNavigationProvider } from "@/components/map/PostClaimNavigationProvider";
import {
  offerPostClaimNavigation,
  resetPostClaimNavigationForTests,
} from "@/lib/map/post-claim-navigation";

const { claimSpotMock } = vi.hoisted(() => ({
  claimSpotMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  claimSpot: claimSpotMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/map/CancelClaimButton", () => ({
  CancelClaimButton: () => <button type="button">Release spot</button>,
}));

vi.mock("@/components/map/CompleteHandoffForm", () => ({
  CompleteHandoffForm: () => (
    <button type="button">Complete handoff</button>
  ),
}));

vi.mock("@/components/ui/HandoffWindowCountdown", () => ({
  HandoffWindowCountdown: () => <div data-testid="handoff-window-countdown" />,
}));

vi.mock("@/lib/location/use-seeker-live-location-share", () => ({
  useSeekerLiveLocationShare: () => ({
    uiState: "idle",
    resumedOnce: false,
    startSharing: vi.fn(),
    stopSharing: vi.fn(),
    forceStop: vi.fn(),
  }),
}));

const spotId = "550e8400-e29b-41d4-a716-446655440000";
const claimId = "11111111-1111-4111-8111-111111111111";
const destination = { latitude: 32.085312, longitude: 34.781812 };

const claim = {
  claimId,
  claimExpiresAt: "2026-08-04T13:00:00.000Z",
  spotAvailableAt: "2026-08-04T12:45:00.000Z",
  spotExpiresAt: "2026-08-04T12:50:00.000Z",
  spotAddress: "Rothschild Blvd 1",
};

describe("post-claim navigation flow", () => {
  beforeEach(() => {
    claimSpotMock.mockReset();
    resetPostClaimNavigationForTests();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ closed: false })),
    );
  });

  it("keeps the chooser open after the claim subtree remounts", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId,
      claimExpiresAt: claim.claimExpiresAt,
    });

    const { rerender } = render(
      <FeedbackShell>
        <ClaimSpotButton
          spotId={spotId}
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    const sheet = await screen.findByTestId("navigation-provider-sheet");
    expect(within(sheet).getByText("Open in")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Waze" })).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Google Maps" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Apple Maps" }),
    ).toBeInTheDocument();

    rerender(
      <FeedbackShell>
        <ActiveClaimPanel claim={claim} destination={destination} />
      </FeedbackShell>,
    );

    expect(screen.getByTestId("navigation-provider-sheet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();
  });

  it("does not open the chooser when claim fails", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      error: "Not enough credits.",
      errorCode: "INSUFFICIENT_CREDITS",
    });

    render(
      <FeedbackShell>
        <ClaimSpotButton
          spotId={spotId}
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "I’m on my way" }));
    expect(await screen.findByTestId("feedback-toast-error")).toBeInTheDocument();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
  });

  it("opens the chooser exactly once after a successful claim offer", async () => {
    render(
      <PostClaimNavigationProvider>
        <ActiveClaimPanel claim={claim} destination={destination} />
      </PostClaimNavigationProvider>,
    );

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    offerPostClaimNavigation({ claimId, ...destination });
    expect(await screen.findByTestId("navigation-provider-sheet")).toBeInTheDocument();
    expect(screen.getAllByTestId("navigation-provider-sheet")).toHaveLength(1);
  });

  it("does not auto-open for an active claim loaded without a fresh offer", () => {
    render(
      <PostClaimNavigationProvider>
        <ActiveClaimPanel claim={claim} destination={destination} />
      </PostClaimNavigationProvider>,
    );

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeInTheDocument();
  });

  it("keeps the claim active after Dismiss and reopens from Open navigation", async () => {
    const user = userEvent.setup();
    render(
      <PostClaimNavigationProvider>
        <ActiveClaimPanel claim={claim} destination={destination} />
      </PostClaimNavigationProvider>,
    );

    offerPostClaimNavigation({ claimId, ...destination });
    const sheet = await screen.findByTestId("navigation-provider-sheet");
    await user.click(within(sheet).getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-claim-sheet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release spot" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const reopened = screen.getByTestId("navigation-provider-sheet");
    expect(within(reopened).getByText("Open in")).toBeInTheDocument();
    expect(within(reopened).getByRole("button", { name: "Waze" })).toBeInTheDocument();
  });
});
