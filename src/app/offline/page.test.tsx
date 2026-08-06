import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/pwa/OfflineRetryButton", () => ({
  OfflineRetryButton: () => (
    <button type="button">Try again</button>
  ),
}));

import OfflinePage from "@/app/offline/page";

describe("OfflinePage", () => {
  it("shows friendly offline copy and retry action", () => {
    render(<OfflinePage />);

    expect(
      screen.getByRole("heading", { name: "You're offline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Reconnect to continue finding or sharing parking."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Switch It needs a connection for live parking updates."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
