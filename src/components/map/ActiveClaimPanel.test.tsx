import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_CLAIM_DESTINATION_FALLBACK,
  ActiveClaimPanel,
  activeClaimDestinationLabel,
} from "@/components/map/ActiveClaimPanel";

vi.mock("@/components/map/CancelClaimButton", () => ({
  CancelClaimButton: ({ claimId }: { claimId: string }) => (
    <button type="button" data-claim-id={claimId}>
      I’m no longer coming
    </button>
  ),
}));

vi.mock("@/components/map/CompleteClaimButton", () => ({
  CompleteClaimButton: ({ claimId }: { claimId: string }) => (
    <button type="button" data-claim-id={claimId}>
      I got the spot
    </button>
  ),
}));

vi.mock("@/components/ui/Countdown", () => ({
  Countdown: ({
    pendingLabel,
    readyLabel,
  }: {
    pendingLabel?: string;
    readyLabel?: string;
  }) => <span>{pendingLabel ?? readyLabel ?? "Available in 5:00"}</span>,
}));

const claim = {
  claimId: "11111111-1111-4111-8111-111111111111",
  claimExpiresAt: "2026-08-04T13:00:00.000Z",
  spotAvailableAt: "2026-08-04T12:45:00.000Z",
  spotAddress: "Rothschild Blvd 1",
};

const destination = {
  latitude: 32.085312,
  longitude: 34.781812,
};

describe("activeClaimDestinationLabel", () => {
  it("uses the fallback when address is missing", () => {
    expect(activeClaimDestinationLabel(null)).toBe(
      ACTIVE_CLAIM_DESTINATION_FALLBACK,
    );
    expect(activeClaimDestinationLabel("   ")).toBe(
      ACTIVE_CLAIM_DESTINATION_FALLBACK,
    );
    expect(activeClaimDestinationLabel("Rothschild")).toBe("Rothschild");
  });
});

describe("ActiveClaimPanel sheet UX", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ closed: false })),
    );
  });

  it("starts expanded with complete and cancel actions", () => {
    render(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    const region = screen.getByRole("region", { name: "Rothschild Blvd 1" });
    expect(region).toHaveAttribute("aria-labelledby");
    expect(region).not.toHaveAttribute("aria-label");
    expect(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I got the spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I’m no longer coming" }),
    ).toBeInTheDocument();
  });

  it("keeps Navigate available when collapsed and hides complete/cancel", async () => {
    const user = userEvent.setup();
    render(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );

    expect(
      screen.getByRole("button", { name: /Expand claim details/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I got the spot" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I’m no longer coming" }),
    ).not.toBeInTheDocument();
  });

  it("expands again to reveal complete and cancel", async () => {
    const user = userEvent.setup();
    render(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Collapse claim details/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Expand claim details/i }),
    );

    expect(
      screen.getByRole("button", { name: "I got the spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I’m no longer coming" }),
    ).toBeInTheDocument();
  });

  it("uses the destination fallback when address is missing", () => {
    render(
      <ActiveClaimPanel
        claim={{ ...claim, spotAddress: null }}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(
      screen.getByRole("region", { name: ACTIVE_CLAIM_DESTINATION_FALLBACK }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(ACTIVE_CLAIM_DESTINATION_FALLBACK),
    ).toBeInTheDocument();
    expect(screen.queryByText(/32\.085/)).not.toBeInTheDocument();
  });

  it("collapses on Escape without removing the claim experience", async () => {
    const user = userEvent.setup();
    render(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(
      screen.getByRole("button", { name: "I’m no longer coming" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Expand claim details/i }),
      ).toHaveAttribute("aria-expanded", "false");
    });
    expect(
      screen.getByRole("region", { name: "Rothschild Blvd 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I’m no longer coming" }),
    ).not.toBeInTheDocument();
  });

  it("shows Navigate for a valid destination and opens the action sheet", async () => {
    const user = userEvent.setup();
    render(
      <ActiveClaimPanel claim={claim} destination={destination} />,
    );

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Open destination in")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open in Waze" }),
    ).toBeInTheDocument();
  });

  it("hides Navigate when destination coordinates are missing or invalid", () => {
    const { rerender } = render(
      <ActiveClaimPanel claim={claim} destination={null} />,
    );
    expect(
      screen.queryByRole("button", { name: "Navigate" }),
    ).not.toBeInTheDocument();

    rerender(
      <ActiveClaimPanel
        claim={claim}
        destination={{ latitude: 999, longitude: 34.78 }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Navigate" }),
    ).not.toBeInTheDocument();
  });

  it("opens Waze with the claimed destination and unchanged payload semantics", async () => {
    const user = userEvent.setup();
    const openSpy = vi.mocked(window.open);
    render(<ActiveClaimPanel claim={claim} destination={destination} />);

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    await user.click(screen.getByRole("button", { name: "Open in Waze" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("preserves claim ids on complete and cancel actions", () => {
    render(
      <ActiveClaimPanel
        claim={claim}
        destination={destination}
        variant="overlay"
      />,
    );

    expect(
      screen.getByRole("button", { name: "I got the spot" }),
    ).toHaveAttribute("data-claim-id", claim.claimId);
    expect(
      screen.getByRole("button", { name: "I’m no longer coming" }),
    ).toHaveAttribute("data-claim-id", claim.claimId);
  });
});

describe("active claim experience gating", () => {
  it("does not render the experience without an ActiveClaimPanel", () => {
    render(<div data-testid="available-spot-card" />);
    expect(
      screen.queryByRole("region", { name: ACTIVE_CLAIM_DESTINATION_FALLBACK }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Rothschild Blvd 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Navigate" }),
    ).not.toBeInTheDocument();
  });
});
