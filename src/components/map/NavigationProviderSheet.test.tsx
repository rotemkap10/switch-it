import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NavigationProviderSheet } from "@/components/map/NavigationProviderSheet";
import { WEB_HANDOFF_LOCATION_DISCLOSURE } from "@/lib/location/handoff-disclosures";
import {
  buildAppleMapsDirectionsUrl,
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
} from "@/lib/map/navigation-urls";

const links = {
  waze: buildWazeNavigateUrl(32.0853, 34.7818),
  googleMaps: buildGoogleMapsDirectionsUrl(32.0853, 34.7818),
  appleMaps: buildAppleMapsDirectionsUrl(32.0853, 34.7818),
};

const globalsCss = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

describe("NavigationProviderSheet layout", () => {
  it("uses the same full-viewport centered portal shell as cancellation dialogs", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <NavigationProviderSheet
        open
        onClose={onClose}
        links={links}
        onChoose={vi.fn()}
      />,
    );

    const backdrop = await screen.findByTestId(
      "navigation-provider-sheet-backdrop",
    );
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop.className).toContain("cancellation-sheet-backdrop");
    expect(backdrop.className).not.toContain("fixed");
    expect(backdrop.className).not.toContain("bottom-0");

    const dialog = screen.getByTestId("navigation-provider-sheet");
    expect(dialog.className).toContain("install-sheet");
    expect(dialog.className).toContain("motion-soft-scale-in");
    expect(dialog.className).not.toContain("motion-fade-slide-up");
    expect(dialog.className).not.toContain("fixed");
    expect(dialog.className).not.toContain("bottom-0");
    expect(dialog.className).not.toContain("left-1/2");

    expect(within(dialog).getByText("Open in")).toBeInTheDocument();
    expect(
      within(dialog).getByText(WEB_HANDOFF_LOCATION_DISCLOSURE),
    ).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shares cancellation backdrop centering rules in global CSS", () => {
    expect(globalsCss).toMatch(
      /\.cancellation-sheet-backdrop\s*\{[^}]*position:\s*fixed/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet-backdrop\s*\{[^}]*inset:\s*0/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet-backdrop\s*\{[^}]*align-items:\s*center/s,
    );
    expect(globalsCss).toMatch(
      /\.cancellation-sheet-backdrop\s*\{[^}]*justify-content:\s*center/s,
    );
  });
});
