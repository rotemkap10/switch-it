import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("authenticated header shell contract", () => {
  it("keeps AppNav outside page content and never constrains it to page max-width", () => {
    const frame = source("src/components/auth/AuthenticatedFrame.tsx");
    expect(frame).toContain(
      "<AppNav compact={isMap} displayName={displayName} credits={credits} />",
    );
    expect(frame).not.toContain("<HandoffCompletionSuccessController />");
    expect(frame.indexOf("<AppNav")).toBeLessThan(frame.indexOf("<main"));
    const root = source("src/components/feedback/AppFeedbackRoot.tsx");
    expect(root).toContain("<HandoffCompletionSuccessController />");
    expect(root).toContain("<HandoffTerminalEndedController />");
    const shell = source("src/components/auth/AuthenticatedShell.tsx");
    expect(shell).toContain('.select("display_name, credits")');
    expect(shell).toContain("credits={shellProfile.credits}");
  });

  it("uses one shared header inner on live nav and loading chrome", () => {
    const nav = source("src/components/layout/AppNav.tsx");
    const pageLoading = source("src/components/shell/PageRouteLoadingChrome.tsx");
    const mapLoading = source("src/components/map/MapRouteTransitionShell.tsx");
    const inner = source("src/components/layout/AppShellHeaderInner.tsx");

    expect(nav).toContain("<AppShellHeaderInner>");
    expect(nav).toContain('variant="nav"');
    expect(pageLoading).toContain('<AppShellHeaderLoadingPlaceholder mode="none" />');
    expect(mapLoading).toContain("<AppShellHeaderLoadingPlaceholder");
    expect(inner).toContain('className={APP_SHELL_HEADER_INNER_CLASS}');
    expect(inner).toContain('variant="nav"');
    expect(nav).not.toContain("app-shell-header-inner--contained");
    expect(pageLoading).not.toContain("app-shell-header-inner--contained");
    expect(mapLoading).not.toContain("app-shell-header-inner--contained");
  });

  it("lets Profile and History keep page titles in content, not a custom header", () => {
    const profile = source("src/app/profile/page.tsx");
    const history = source("src/app/history/page.tsx");
    const help = source("src/app/help/page.tsx");
    const map = source("src/app/map/page.tsx");
    const share = source("src/app/spots/new/page.tsx");

    for (const page of [profile, history, help, map, share]) {
      expect(page).toContain("<AuthenticatedShell");
      expect(page).not.toContain("<AppNav");
    }

    expect(profile).toContain('headerAlign="center"');
    expect(history).toContain('headerAlign="center"');
    expect(help).toContain('headerAlign="center"');
    expect(share).toContain('headerAlign="center"');
    expect(map).toContain('layout="map"');
    expect(map).not.toContain('headerAlign="center"');
  });

  it("loads header credits from the same profiles.credits field as Profile", () => {
    const shell = source("src/components/auth/AuthenticatedShell.tsx");
    const profile = source("src/app/profile/page.tsx");
    expect(shell).toContain('.select("display_name, credits")');
    expect(shell).toContain("credits={shellProfile.credits}");
    expect(profile).toContain("display_name, credits, role");
    expect(profile).toContain("credits={profile.credits}");
  });
});
