import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";
import {
  peekPostClaimNavigationPendingForTests,
  resetPostClaimNavigationForTests,
} from "@/lib/map/post-claim-navigation";
import {
  resetSensoryAdaptersForTests,
  setSensoryAdaptersForTests,
} from "@/lib/sensory/feedback";

const { claimSpotMock, requestLocationMock } = vi.hoisted(() => ({
  claimSpotMock: vi.fn(),
  requestLocationMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  claimSpot: claimSpotMock,
}));

vi.mock("@/lib/map/request-current-device-location", () => ({
  requestCurrentDeviceLocation: (...args: unknown[]) =>
    requestLocationMock(...args),
}));

const spotId = "550e8400-e29b-41d4-a716-446655440000";
const destination = { latitude: 32.085312, longitude: 34.781812 };
const nearbySeeker = { latitude: 32.086, longitude: 34.781812 };
const farSeeker = { latitude: 32.12, longitude: 34.781812 };

function renderClaimButton(
  props: Partial<{
    seekerLocation: { latitude: number; longitude: number } | null;
  }> = {},
) {
  return render(
    <FeedbackShell>
      <ClaimSpotButton
        spotId={spotId}
        latitude={destination.latitude}
        longitude={destination.longitude}
        seekerLocation={props.seekerLocation ?? nearbySeeker}
      />
    </FeedbackShell>,
  );
}

describe("ClaimSpotButton", () => {
  beforeEach(() => {
    claimSpotMock.mockReset();
    requestLocationMock.mockReset();
    requestLocationMock.mockResolvedValue({
      ok: true,
      fix: {
        latitude: nearbySeeker.latitude,
        longitude: nearbySeeker.longitude,
        accuracy: 12,
        timestamp: Date.now(),
      },
    });
    resetPostClaimNavigationForTests();
    resetSensoryAdaptersForTests();
  });

  it("renders the friendly primary wording", () => {
    renderClaimButton();

    expect(
      screen.getByRole("button", { name: "I’m on my way" }),
    ).toBeInTheDocument();
  });

  it("requests a fresh location and submits seeker coordinates with the claim", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    await waitFor(() => {
      expect(requestLocationMock).toHaveBeenCalled();
      expect(claimSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = claimSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("spot_id")).toBe(spotId);
    expect(formData.get("seeker_latitude")).toBe(String(nearbySeeker.latitude));
    expect(formData.get("seeker_longitude")).toBe(
      String(nearbySeeker.longitude),
    );
  });

  it("blocks claim when known seeker location is outside the radius", () => {
    renderClaimButton({ seekerLocation: farSeeker });

    expect(screen.getByTestId("claim-too-far-notice")).toHaveTextContent(
      "This spot is too far away to claim.",
    );
    expect(
      screen.queryByRole("button", { name: "I’m on my way" }),
    ).not.toBeInTheDocument();
  });

  it("shows a location-required message when a fresh fix is unavailable", async () => {
    const user = userEvent.setup();
    requestLocationMock.mockResolvedValue({
      ok: false,
      reason: "denied",
    });

    renderClaimButton({ seekerLocation: null });
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByTestId("claim-local-error")).toHaveTextContent(
      "Live location is required during a parking handoff.",
    );
    expect(claimSpotMock).not.toHaveBeenCalled();
  });

  it("blocks claim when location is unavailable without creating a claim", async () => {
    const user = userEvent.setup();
    requestLocationMock.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    renderClaimButton({ seekerLocation: null });
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByTestId("claim-local-error")).toHaveTextContent(
      "Live location is required during a parking handoff.",
    );
    expect(claimSpotMock).not.toHaveBeenCalled();
  });

  it("explains that live location is required before claiming", () => {
    renderClaimButton({ seekerLocation: null });
    expect(screen.getByTestId("claim-location-hint")).toHaveTextContent(
      "Live location is required during a parking handoff.",
    );
  });

  it("shows a pending disabled state that prevents duplicate submits", async () => {
    const user = userEvent.setup();
    let resolveClaim: (value: {
      success: boolean;
      claimId: string;
      claimExpiresAt: string;
    }) => void = () => {};

    claimSpotMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClaim = resolve;
        }),
    );

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    const pendingButton = await screen.findByRole("button", {
      name: /Claiming…|Getting location…/,
    });
    expect(pendingButton).toBeDisabled();

    await waitFor(() => {
      expect(claimSpotMock).toHaveBeenCalledTimes(1);
    });

    await user.click(pendingButton);
    expect(claimSpotMock).toHaveBeenCalledTimes(1);

    resolveClaim({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    expect(await screen.findByText("Opening your trip…")).toBeInTheDocument();
    expect(
      await screen.findByTestId("feedback-toast-success"),
    ).toHaveTextContent("You’re on your way.");
    expect(await screen.findByTestId("navigation-provider-sheet")).toBeInTheDocument();
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
  });

  it("surfaces stale claim race with friendly toast feedback", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      error: "This spot was just claimed by another driver.",
      errorCode: "SPOT_UNAVAILABLE",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByTestId("feedback-toast-error")).toHaveTextContent(
      "This spot was just claimed by another driver.",
    );
    expect(
      screen.getByRole("button", { name: "I’m on my way" }),
    ).toBeInTheDocument();
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
  });

  it("opens the navigation chooser after a successful claim action", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByText("Opening your trip…")).toBeInTheDocument();
    expect(
      await screen.findByTestId("feedback-toast-success"),
    ).toHaveTextContent("You’re on your way.");
    expect(
      screen.queryByRole("button", { name: "I’m on my way" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("navigation-provider-sheet")).toBeInTheDocument();
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
  });

  it("does not offer navigation when the claim action fails", async () => {
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      error: "Not enough credits.",
      errorCode: "INSUFFICIENT_CREDITS",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    expect(await screen.findByTestId("feedback-toast-error")).toHaveTextContent(
      "Not enough credits.",
    );
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
    expect(screen.queryByTestId("navigation-provider-sheet")).not.toBeInTheDocument();
  });

  it("still claims when haptic feedback throws", async () => {
    setSensoryAdaptersForTests({
      playSound: vi.fn(),
      haptic: () => {
        throw new Error("haptic failed");
      },
    });
    const user = userEvent.setup();
    claimSpotMock.mockResolvedValue({
      success: true,
      claimId: "11111111-1111-4111-8111-111111111111",
      claimExpiresAt: "2026-08-03T12:30:00.000Z",
    });

    renderClaimButton();
    await user.click(screen.getByRole("button", { name: "I’m on my way" }));

    await waitFor(() => {
      expect(claimSpotMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Opening your trip…")).toBeInTheDocument();
  });
});
