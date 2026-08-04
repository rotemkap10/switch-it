import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveClaimPanel } from "@/components/map/ActiveClaimPanel";

vi.mock("@/components/map/CancelClaimButton", () => ({
  CancelClaimButton: () => <button type="button">Cancel trip</button>,
}));

vi.mock("@/components/map/CompleteClaimButton", () => ({
  CompleteClaimButton: () => <button type="button">I got the spot</button>,
}));

vi.mock("@/components/ui/Countdown", () => ({
  Countdown: () => <span>Available in 5:00</span>,
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

describe("ActiveClaimPanel navigation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ closed: false })),
    );
  });

  it("shows Navigate for a valid active-claim destination", () => {
    render(<ActiveClaimPanel claim={claim} destination={destination} />);
    expect(
      screen.getByRole("button", { name: "Navigate" }),
    ).toBeInTheDocument();
  });

  it("hides Navigate when destination coordinates are missing", () => {
    render(<ActiveClaimPanel claim={claim} destination={null} />);
    expect(
      screen.queryByRole("button", { name: "Navigate" }),
    ).not.toBeInTheDocument();
  });

  it("hides Navigate when destination coordinates are invalid", () => {
    render(
      <ActiveClaimPanel
        claim={claim}
        destination={{ latitude: 999, longitude: 34.78 }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Navigate" }),
    ).not.toBeInTheDocument();
  });

  it("opens and closes the navigation action sheet", async () => {
    const user = userEvent.setup();
    render(<ActiveClaimPanel claim={claim} destination={destination} />);

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open in Waze" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open in Google Maps" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens Waze and Google Maps with the claimed destination", async () => {
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

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    await user.click(
      screen.getByRole("button", { name: "Open in Google Maps" }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&destination=32.085312%2C34.781812",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("closes the sheet on Escape", async () => {
    const user = userEvent.setup();
    render(<ActiveClaimPanel claim={claim} destination={destination} />);

    await user.click(screen.getByRole("button", { name: "Navigate" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes the sheet on outside click and returns focus to Navigate", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <ActiveClaimPanel claim={claim} destination={destination} />
      </div>,
    );

    const navigate = screen.getByRole("button", { name: "Navigate" });
    await user.click(navigate);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(navigate).toHaveFocus();
  });
});

describe("navigation not shown outside active claims", () => {
  it("does not render navigation UI without an ActiveClaimPanel", () => {
    const { container } = render(<div data-testid="available-spot-card" />);
    expect(container.querySelector("[aria-haspopup='dialog']")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Navigate" }),
    ).not.toBeInTheDocument();
  });
});
