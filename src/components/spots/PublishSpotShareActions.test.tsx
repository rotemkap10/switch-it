import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PUBLISHER_MOBILE_CTA_MEDIA_QUERY,
  PublishSpotShareActions,
  usePublisherMobileViewportCta,
} from "@/components/spots/PublishSpotShareActions";

function MediaProbe() {
  const mobile = usePublisherMobileViewportCta();
  return <span data-testid="media-probe">{mobile ? "mobile" : "desktop"}</span>;
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === PUBLISHER_MOBILE_CTA_MEDIA_QUERY ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    })),
  );
}

describe("PublishSpotShareActions", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("portals the mobile CTA to document.body with viewport-fixed chrome", () => {
    stubMatchMedia(true);

    const { container } = render(
      <form id="publish-spot-form">
        <PublishSpotShareActions viewportFixed>
          <button type="submit" form="publish-spot-form">
            Share spot
          </button>
        </PublishSpotShareActions>
      </form>,
    );

    const actions = screen.getByTestId("publish-spot-actions");
    expect(actions).toHaveAttribute("data-viewport-fixed", "true");
    expect(actions.className).toContain("publisher-compose-actions--viewport");
    expect(document.body.contains(actions)).toBe(true);
    expect(container.contains(actions)).toBe(false);
    expect(screen.getAllByRole("button", { name: "Share spot" })).toHaveLength(
      1,
    );
  });

  it("keeps the desktop CTA inline after the form content", () => {
    stubMatchMedia(false);

    const { container } = render(
      <form id="publish-spot-form">
        <div data-testid="leave-time-section">When</div>
        <PublishSpotShareActions viewportFixed={false}>
          <button type="submit" form="publish-spot-form">
            Share spot
          </button>
        </PublishSpotShareActions>
      </form>,
    );

    const form = container.querySelector("form");
    const actions = screen.getByTestId("publish-spot-actions");
    expect(actions).toHaveAttribute("data-viewport-fixed", "false");
    expect(actions.className).not.toContain(
      "publisher-compose-actions--viewport",
    );
    expect(form?.contains(actions)).toBe(true);
  });

  it("detects the mobile CTA media query before paint", async () => {
    stubMatchMedia(true);
    render(<MediaProbe />);
    await waitFor(() => {
      expect(screen.getByTestId("media-probe")).toHaveTextContent("mobile");
    });
  });
});
